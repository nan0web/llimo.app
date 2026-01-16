import process from "node:process"

import { Progress } from '../src/cli/components/Progress.js'
import { Ui } from '../src/cli/Ui.js'

export class ProgressDemo {
	static async run() {
		const DELAY = parseInt(process.env.DELAY ?? "200")
		const ui = new Ui()

		ui.console.info('=== Progress Component Demo ===')

		// Basic progress
		const basicProgress = new Progress({ value: 0.5, text: 'Basic Progress', prefix: 'D ' })
		ui.console.info('Basic (50%)')
		ui.render(basicProgress)
		ui.console.info('')

		// Custom options
		const customProgress = new Progress({
			value: 0.75,
			text: 'Downloading...',
			prefix: '⬇ '
		})
		ui.overwriteLine(customProgress.toString({ fill: '█', space: '░' }))
		await new Promise(resolve => setTimeout(resolve, 2 * DELAY)) // Pause to show
		ui.console.info('Custom (75%) with options')
		ui.console.info('')

		// Simulate updating progress
		ui.console.info('Simulating progress updates:')
		const totalSteps = 10
		for (let i = 0; i <= totalSteps; i += 2) {
			const progress = new Progress({ value: i / totalSteps, text: `Step ${i}/10`, prefix: '⏳ ' })
			ui.overwriteLine(progress.toString())
			await new Promise(resolve => setTimeout(resolve, DELAY))
		}
		ui.console.info('') // New line after simulation

		// Zero progress
		const zeroProgress = new Progress({ value: 0, text: 'Starting...' })
		ui.render(zeroProgress)
		ui.console.info('')

		ui.console.info('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	ProgressDemo.run().catch(console.error)
}
