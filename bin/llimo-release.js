#!/usr/bin/env node
import { resolve } from "node:path"

import { ReleaseCommand, ReleaseOptions } from "../src/Chat/commands/release.js"
import { parseArgv } from "../src/cli/argvHelper.js"
import { Ui }from "../src/cli/Ui.js"
import { DIM, GREEN, MAGENTA, RED, RESET } from "../src/cli/ANSI.js"
import ReleaseProtocol from "../src/utils/Release.js"
import { FileSystem } from "../src/utils/FileSystem.js"

const ui = new Ui({ debugMode: process.argv.includes("--debug") })

export async function main(argv = process.argv.slice(2)) {
	const options = parseArgv(argv, ReleaseOptions)
	const release = new ReleaseProtocol({ version: options.release })
	const cmd = new ReleaseCommand({ options, ui })
	const fs = new FileSystem({ cwd: resolve("releases", release.x, release.version) })

	const taskStates = new Map()
	const ensureTask = (task) => {
		const taskId = task.link.split("/")[0]
		if (!taskStates.has(taskId)) {
			taskStates.set(taskId, {
				id: taskId,
				label: task.label ?? taskId,
				status: "pending",
				stageLabel: "pending",
				stagePercent: 0,
				chunks: [],
				start: null,
			})
		}
		return taskStates.get(taskId)
	}

	const appendLog = (state, msg) => {
		const trimmed = (msg ?? "").trim()
		if (!trimmed) return
		fs.append(state.id + "/task.log", `${new Date().toISOString()} ${trimmed}\n`)
	}

	const handleChunk = ({ task, chunk }) => {
		const state = ensureTask(task)
		if (!state.start) state.start = Date.now()
		if ("string" === typeof chunk) {
			state.chunks.push(chunk)
			state.status = "working"
			appendLog(state, chunk)
			return
		}
		if (chunk?.type === "stage") {
			state.status = state.status === "complete" ? "complete" : "working"
			state.stageLabel = chunk.message ?? chunk.stage ?? state.stageLabel
			if ("number" === typeof chunk.stageIndex && chunk.stageIndex >= 0) {
				state.stagePercent = Math.min(100, Math.round(((chunk.stageIndex + 1) / ReleaseCommand.STAGE_DETAILS.length) * 100))
			}
			state.chunks.push(state.stageLabel)
			appendLog(state, `${state.stageLabel} ${chunk.message ?? ""}`.trim())
			return
		}
		if (chunk?.type === "status") {
			state.status = chunk.status === "complete" ? "complete" : "fail"
			state.stagePercent = 100
			state.chunks.push(chunk.message ?? chunk.status)
			appendLog(state, `status: ${chunk.status} ${chunk.message ?? ""}`.trim())
		}
	}

	let printed = 0
	const startTime = Date.now()
	const render = ({ elapsed }) => {
		const [, height] = ui.stdout.getWindowSize?.() ?? [120, 30]
		if (printed) ui.cursorUp(printed)

		const wh = Math.floor((height - 1) / cmd.tasks.length)
		const lines = []
		const totalTasks = Math.max(1, cmd.tasks.length || 1)
		const byStatus = {
			complete: Array.from(taskStates.values()).filter(s => s.status === "complete").length,
			fail: Array.from(taskStates.values()).filter(s => s.status === "fail").length,
			working: Array.from(taskStates.values()).filter(s => s.status === "working").length,
			waiting: Array.from(taskStates.values()).filter(s => s.status === "waiting").length,
			pending: Array.from(taskStates.values()).filter(s => s.status === "pending").length,
		}
		const completed = byStatus.complete + byStatus.fail
		const globalBar = ui.bar(completed, totalTasks, 30, "■", " ")
		const globalStatus = [
			`${GREEN}${byStatus.complete} complete${RESET}`,
			`${RED}${byStatus.fail} fail${RESET}`,
			`${DIM}${byStatus.working} working${RESET}`,
			`${DIM}${byStatus.waiting} waiting${RESET}`,
			`${byStatus.pending} pending`,
		].join(" • ")
		lines.push(`${ui.formats.timer(elapsed)} ${globalBar} ${completed}/${totalTasks} tasks • ${globalStatus}`)

		if (!cmd.tasks.length) {
			lines.push("Preparing task list...")
		} else {
			for (const task of cmd.tasks) {
				const state = taskStates.get(task.link.split("/")[0]) ?? {
					status: "pending",
					stageLabel: "pending",
					stagePercent: 0,
					chunks: [],
					start: null,
				}
				const taskBar = ui.bar(state.stagePercent, 100, 20, "■", " ")
				const duration = state.start ? ui.formats.timer(Date.now() - state.start) : "00:00"
				const statusLabel = state.status === "complete" ? `${GREEN}done${RESET}`
					: state.status === "fail" ? `${RED}fail${RESET}`
						: state.status === "working" ? `${DIM}running${RESET}`
							: state.status === "waiting" ? `${DIM}waiting${RESET}`
								: "pending"
				lines.push(`${task.link.padEnd(35)} ${taskBar} ${state.stageLabel ?? statusLabel} ${duration}`)
				let tail = []
				if (wh && state.chunks.length) {
					tail = state.chunks.slice(-wh)
					tail.map(chunk => lines.push(`  ${MAGENTA}${DIM}${chunk}${RESET}`))
				}
				for (let i = 0; i < wh - tail.length; i++) lines.push("")
			}
		}

		const safeHeight = Math.max(0, height - 1)
		for (let i = 0; i < Math.min(lines.length, safeHeight); i++) {
			ui.overwriteLine(lines[i])
			ui.console.info()
		}
		printed = Math.min(lines.length, safeHeight)
	}

	const displaying = ui.createProgress(render, startTime, 33)
	const stream = cmd.run({ onData: handleChunk })
	for await (const element of stream) {
		if (true === element) {
			ui.console.success("Complete")
		} else if (false === element) {
			ui.console.error("Failed")
		} else {
			ui.render(element)
		}
	}
	clearInterval(displaying)
	render({ elapsed: Date.now() - startTime })
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		ui.console.error(err.message)
		if (err.stack) ui.console.debug(err.stack)
		process.exit(1)
	})
}
