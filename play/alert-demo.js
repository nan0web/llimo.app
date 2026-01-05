import { Alert } from '../src/cli/components/Alert.js'
import { Ui }from '../src/cli/Ui.js'

export class AlertDemo {
	static async run() {
		const ui = new Ui()

		console.info('=== Alert Component Demo ===')

		// Success
		const successAlert = Alert.info('Task completed successfully!')
		ui.render(successAlert)
		console.info('')

		// Warning
		const warnAlert = new Alert({ variant: 'warn', text: 'This is a warning' })
		ui.render(warnAlert)
		console.info('')

		// Error
		const errorAlert = Alert.error('An error occurred')
		ui.render(errorAlert)
		console.info('')

		// Custom construction
		const customAlert = new Alert({
			text: 'Custom alert via constructor',
			variant: 'debug' // defaults to info if invalid
		})
		ui.render(customAlert)
		console.info('')

		// String input (simple text)
		const simpleAlert = Alert.info('Simple alert from string')
		ui.render(simpleAlert)
		console.info('')

		console.info('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	AlertDemo.run().catch(console.error)
}
