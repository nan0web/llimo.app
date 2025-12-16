import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readdir } from "node:fs/promises"
import { resolve } from "node:path"

describe("LLiMo v1.0.0 Release Verification", () => {
	const releaseDir = resolve("releases/v1.0.0")

	it("all task.test.js PASS (spawn exitCode 0)", async () => {
		const groups = await readdir(releaseDir)
		const passGroups = []
		const failGroups = []

		for (const group
