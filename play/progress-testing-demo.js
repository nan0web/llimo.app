import process from "node:process"

export class ProgressTestingDemo {
	static async run() {
		const { main } = await import("./cli/testing/progress.js")
		await main(process.argv.slice(2))
	}
}
