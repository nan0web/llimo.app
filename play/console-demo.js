import Ui, { UiConsole } from '../src/cli/Ui.js'

export class ConsoleDemo {
	static async run() {
		const console = new UiConsole({
			debugMode: true,
			logFile: 'console-demo.log'
		})

		console.info('=== UiConsole Demo ===')

		// Basic methods
		console.debug('This is a debug message')
		console.info('This is an info message')
		console.log('This is a log message')
		console.warn('This is a warning message')
		console.error('This is an error message')
		console.success('This is a success message')
		console.info('')

		// Table rendering
		console.info('Rendering a table:')
		console.table([
			["Type", "Message"],
			["debug", "Debug line"],
			["info", "Info line"]
		], { aligns: ["left", "left"] })
		console.info('')

		// Overwrite line
		// console.info('Overwriting line demo:')
		// console.overwriteLine('First line')
		await new Promise(resolve => setTimeout(resolve, 500))
		// console.overwriteLine('Updated line')

		// Full line padding (to window width)
		console.info('Full width message:')
		console.full('This message will be padded to full width', "•", "→") // true for console.info instead of overwrite

		// Style extraction (padding)
		console.info('Styled message with padding:')
		const ui = new Ui()
		console.info('Padded:', ui.createStyle({ paddingLeft: 4 }) , 'content')

		// Extract message from styles
		const styled = console.extractMessage(['Hello', ui.createStyle({ paddingLeft: 2 }), 'World'])
		console.info('Extracted:', styled)

		console.info('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	ConsoleDemo.run().catch(console.error)
}
