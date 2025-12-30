import { Progress } from '../src/cli/components/Progress.js'
import Ui from '../src/cli/Ui.js'

export class ProgressDemo {
	static async run() {
		const ui = new Ui()

		console.log('=== Progress Component Demo ===')

		// Basic progress
		const basicProgress = new Progress({ value: 50, text: 'Basic Progress', prefix: 'D ' })
		console.log('Basic (50%)')
		basicProgress.renderIn(ui)
		console.log('')

		// Custom options
		const customProgress = new Progress({
			value: 75,
			text: 'Downloading...',
			prefix: '⬇ '
		})
		ui.overwriteLine(customProgress.toString({ fill: '█', space: '░' }))
		console.log('Custom (75%) with options')

		// Simulate updating progress
		console.log('Simulating progress updates:')
		const totalSteps = 10
		for (let i = 0; i <= totalSteps; i += 2) {
			const progress = new Progress({ value: i * 10, text: `Step ${i}/10`, prefix: '⏳ ' })
			ui.overwriteLine(progress.toString())
			await new Promise(resolve => setTimeout(resolve, 200))
		}
		console.log('') // New line after simulation

		// Zero progress
		const zeroProgress = new Progress({ value: 0, text: 'Starting...' })
		zeroProgress.renderIn(ui)
		console.log('')

		console.log('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	ProgressDemo.run().catch(console.error)
}
