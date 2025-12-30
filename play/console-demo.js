import { UiConsole } from '../src/cli/Ui.js'

export class ConsoleDemo {
	static async run() {
		const consoleInstance = new UiConsole({
			debugMode: true,
			logFile: 'console-demo.log'
		})

		console.log('=== UiConsole Demo ===')

		// Basic methods
		consoleInstance.debug('This is a debug message')
		consoleInstance.info('This is an info message')
		consoleInstance.log('This is a log message')
		consoleInstance.warn('This is a warning message')
		consoleInstance.error('This is an error message')
		consoleInstance.success('This is a success message')
		console.log('')

		// Table rendering
		console.log('Rendering a table:')
		consoleInstance.table([
			["Type", "Message"],
			["debug", "Debug line"],
			["info", "Info line"]
		], { aligns: ["left", "left"] })
		console.log('')

		// Overwrite line
		console.log('Overwriting line demo:')
		consoleInstance.overwriteLine('First line')
		await new Promise(resolve => setTimeout(resolve, 500))
		consoleInstance.overwriteLine('Updated line')

		// Full line padding (to window width)
		console.log('Full width message:')
		consoleInstance.full('This message will be padded to full width', true) // true for console.log instead of overwrite

		// Style extraction (padding)
		console.log('Styled message with padding:')
		consoleInstance.info('Padded:', new UiConsole().createStyle({ paddingLeft: 4 }), 'content')

		// Extract message from styles
		const styled = consoleInstance.extractMessage(['Hello', new UiConsole().createStyle({ paddingLeft: 2 }), 'World'])
		consoleInstance.log('Extracted:', styled)

		console.log('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	ConsoleDemo.run().catch(console.error)
}
