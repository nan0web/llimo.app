import { MAGENTA, RESET, YELLOW } from '../src/cli/ANSI.js'
import { Ui } from '../src/cli/Ui.js'

export class UiDemo {
	static async run() {
		const ui = new Ui({
			debugMode: true,
			logFile: 'ui-demo.log'
		})

		ui.console.info('=== Ui: Full Helper Demo ===')
		ui.console.info('Debug mode enabled, logging to ui-demo.log')

		// Setup and basic output
		ui.setup(true, 'ui-demo.log')
		ui.console.info('Setup complete (debug: true)')

		// Formats
		ui.console.info('Formatting a price: $' + ui.formats.money(123.45))
		ui.console.info('Token weight: ' + ui.formats.weight('T', 1500))
		ui.console.info('Byte weight: ' + ui.formats.weight('b', 2048))
		ui.console.info('Timer: ' + ui.formats.timer(125.6))

		// Ask a question
		const answer = await ui.ask('Enter your name: ')
		ui.console.info('You entered: ' + answer)

		// Ask yes/no
		const yn = await ui.askYesNo('Continue? (y/n): ')
		ui.console.info('Yes/No answer: ' + yn)

		// Progress simulation
		ui.console.info('Simulating progress...')
		const progress = ui.createProgress(({ elapsed }) => {
			const bar = '='.repeat(10 * Math.min(30, elapsed)) + ' '.repeat(30 - 10 * Math.min(30, elapsed))
			ui.overwriteLine(`Progress [${bar}] ${elapsed.toFixed(1)}s`)
		}, Date.now(), 30) // 30 FPS

		await new Promise(resolve => setTimeout(() => resolve(), 3e3))
		ui.console.info()
		clearInterval(progress)

		// Cursor movement
		ui.console.info('Cursor up 2 lines:')
		await new Promise(resolve => setTimeout(resolve, 1e3))
		ui.cursorUp(2)
		ui.console.warn('Writing text  ')
		await new Promise(resolve => setTimeout(resolve, 1e3))
		ui.console.info(`${MAGENTA}And next line ${RESET}`)
		await new Promise(resolve => setTimeout(resolve, 1e3))

		ui.console.success('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	UiDemo.run().catch(console.error)
}
