import { Ui } from '../src/cli/Ui.js'

export class UiDemo {
	static async run() {
		const ui = new Ui({
			debugMode: true,
			logFile: 'ui-demo.log'
		})

		console.log('=== Ui: Full Helper Demo ===')
		console.log('Debug mode enabled, logging to ui-demo.log')

		// Setup and basic output
		ui.setup(true, 'ui-demo.log')
		console.log('Setup complete (debug: true)')

		// Formats
		console.log('Formatting a price: $' + ui.formats.money(123.45))
		console.log('Token weight: ' + ui.formats.weight('T', 1500))
		console.log('Byte weight: ' + ui.formats.weight('b', 2048))
		console.log('Timer: ' + ui.formats.timer(125.6))

		// Ask a question
		const answer = await ui.ask('Enter your name: ')
		console.log('You entered: ' + answer)

		// Ask yes/no
		const yn = await ui.askYesNo('Continue? (y/n): ')
		console.log('Yes/No answer: ' + yn)

		// Progress simulation
		console.log('Simulating progress...')
		const progress = ui.createProgress(({ elapsed }) => {
			const bar = '='.repeat(Math.min(50, elapsed)) + ' '.repeat(50 - Math.min(50, elapsed))
			ui.overwriteLine(`Progress [${bar}] ${elapsed.toFixed(1)}s`)
		}, Date.now(), 30) // 30 FPS

		setTimeout(() => clearInterval(progress), 5000)

		// Cursor movement
		console.log('Cursor up 2 lines:')
		ui.cursorUp(2)

		console.log('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	UiDemo.run().catch(console.error)
}
