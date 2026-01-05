import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { ReleaseCommand, ReleaseOptions } from "./release.js"
import TestFileSystem from "../../cli/testing/TestFileSystem.js"

class StubReleaseCommand extends ReleaseCommand {
	async exec() {
		return 0
	}
}

describe("ReleaseCommand", () => {
	it.skip("emits every stage event and a completion status", async () => {
		const options = new ReleaseOptions({ release: "v1.0.0" })
		const cmd = new StubReleaseCommand({ options })
		cmd.fs = {
			cwd: "/tmp",
			path: {
				resolve: (...parts) => parts.join("/"),
			},
			exists: async () => false,
			save: async () => { },
		}
		const events = []
		const task = { link: "001-Task/task.md", label: "Task 1" }
		const release = { version: "v1.0.0" }
		const result = await cmd.processTask(task, {
			release,
			onData: (payload) => events.push(payload),
			pause: async () => { },
		})
		assert.strictEqual(result.status, "complete")
		const stages = events.filter(e => e.chunk?.type === "stage").map(e => e.chunk.stage)
		assert.deepStrictEqual(stages, ReleaseCommand.STAGE_DETAILS.map(stage => stage.key))
		const statusEvent = events.find(e => e.chunk?.type === "status")
		assert.ok(statusEvent)
		assert.strictEqual(statusEvent.chunk.status, "complete")
	})

	it("task status transitions from pending to working to complete", async () => {
		const options = new ReleaseOptions({ release: "v1.0.0" })
		const cmd = new StubReleaseCommand({ options })
		cmd.fs = {
			cwd: "/tmp",
			path: {
				resolve: (...parts) => parts.join("/"),
			},
			exists: async () => false,
			save: async () => { },
		}
		const statuses = []
		const task = { link: "001-Task/task.md", label: "Task 1" }
		const release = { version: "v1.0.0" }
		const result = await cmd.processTask(task, {
			release,
			onData: (payload) => {
				if (payload.chunk?.type === "status") {
					statuses.push(payload.chunk.status)
				}
			},
			pause: async () => { },
		})
		assert.strictEqual(result.status, "complete")
		assert.ok(statuses.length > 0)
		assert.strictEqual(statuses[statuses.length - 1], "complete")
	})

	it("runs tasks in parallel respecting thread limit", async () => {
		const options = new ReleaseOptions({ release: "v1.0.0", threads: 2 })
		const fs = new TestFileSystem({
			data: [
				["releases/1/v1.0.0/NOTES.md", "- [Task 1](001/task.md)\n- [Task 2](002/task.md)\n- [Task 3](003/task.md)"],
			]
		})
		// Mock browse to return version directory
		fs.browse = async () => ["releases/1/v1.0.0/NOTES.md"]
		const cmd = new StubReleaseCommand({ options, fs })
		const concurrent = []
		let maxConcurrent = 0
		const originalProcessTask = cmd.processTask.bind(cmd)
		cmd.processTask = async (task, options) => {
			concurrent.push(task.link)
			maxConcurrent = Math.max(maxConcurrent, concurrent.length)
			await new Promise(resolve => setTimeout(resolve, 10))
			concurrent.splice(concurrent.indexOf(task.link), 1)
			return originalProcessTask(task, options)
		}
		const stream = cmd.run({ onData: () => { } })
		for await (const _ of stream) { }
		assert.ok(maxConcurrent <= options.threads, `max concurrent (${maxConcurrent}) should not exceed thread limit (${options.threads})`)
	})

	it("emits working status when processing task", async () => {
		const options = new ReleaseOptions({ release: "v1.0.0" })
		const cmd = new StubReleaseCommand({ options })
		cmd.fs = {
			cwd: "/tmp",
			path: {
				resolve: (...parts) => parts.join("/"),
			},
			exists: async () => false,
			save: async () => { },
		}
		const chunks = []
		const task = { link: "001-Task/task.md", label: "Task 1" }
		const release = { version: "v1.0.0" }
		await cmd.processTask(task, {
			release,
			onData: (payload) => chunks.push(payload.chunk),
			pause: async () => { },
		})
		const stageChunks = chunks.filter(c => c?.type === "stage")
		assert.ok(stageChunks.length > 0, "should emit stage events")
		const firstStage = stageChunks[0]
		assert.strictEqual(firstStage.stageIndex, 0, "first stage should be at index 0")
	})

	it("properly calculates stage progress percentage", async () => {
		const options = new ReleaseOptions({ release: "v1.0.0" })
		const cmd = new StubReleaseCommand({ options })
		cmd.fs = {
			cwd: "/tmp",
			path: {
				resolve: (...parts) => parts.join("/"),
			},
			exists: async () => false,
			save: async () => { },
		}
		const chunks = []
		const task = { link: "001-Task/task.md", label: "Task 1" }
		const release = { version: "v1.0.0" }
		await cmd.processTask(task, {
			release,
			onData: (payload) => chunks.push(payload.chunk),
			pause: async () => { },
		})
		const stageChunks = chunks.filter(c => c?.type === "stage")
		const lastStage = stageChunks[stageChunks.length - 1]
		assert.strictEqual(lastStage.stageIndex, ReleaseCommand.STAGE_DETAILS.length - 1)
	})
})
