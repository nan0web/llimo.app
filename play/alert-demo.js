import { Alert } from '../src/cli/components/Alert.js'
import Ui from '../src/cli/Ui.js'

export class AlertDemo {
	static async run() {
		const ui = new Ui()

		console.log('=== Alert Component Demo ===')

		// Success
		const successAlert = Alert.info('Task completed successfully!')
		successAlert.renderIn(ui)
		console.log('')

		// Warning
		const warnAlert = new Alert({ variant: 'warn', text: 'This is a warning' })
		warnAlert.renderIn(ui)
		console.log('')

		// Error
		const errorAlert = Alert.error('An error occurred')
		errorAlert.renderIn(ui)
		console.log('')

		// Custom construction
		const customAlert = new Alert({
			text: 'Custom alert via constructor',
			variant: 'debug' // defaults to info if invalid
		})
		customAlert.renderIn(ui)
		console.log('')

		// String input (simple text)
		const simpleAlert = Alert.info('Simple alert from string')
		simpleAlert.renderIn(ui)
		console.log('')

		console.log('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	AlertDemo.run().catch(console.error)
}
