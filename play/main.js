#!/usr/bin/env node
import { UiDemo } from './ui-demo.js'
import { AlertDemo } from './alert-demo.js'
import { TableDemo } from './table-demo.js'
import { ProgressDemo } from './progress-demo.js'
import { ConsoleDemo } from './console-demo.js'
import { ProgressTestingDemo } from './progress-testing-demo.js'
import { Ui }from '../src/cli/Ui.js'

const ui = new Ui({ debugMode: process.argv.slice(2) })

ui.console.info('Select UI Component to Demo:')
ui.console.info('1. Ui (Full UI Helper')
ui.console.info('2. Alert (Console Alert')
ui.console.info('3. Table (Data Table')
ui.console.info('4. Progress (Progress Bar')
ui.console.info('5. UiConsole (Console Wrapper')
ui.console.info('6. Progress Testing (CLI Output')
ui.console.info('7. All (Run all demos)')

ui.ask('Enter number: ').then(async (choice) => {
	const demos = {
		1: () => UiDemo,
		2: () => AlertDemo,
		3: () => TableDemo,
		4: () => ProgressDemo,
		5: () => ConsoleDemo,
		6: () => ProgressTestingDemo,
		7: async () => ({
			run: async () => {
				await UiDemo.run()
				await AlertDemo.run()
				await TableDemo.run()
				await ProgressDemo.run()
				await ConsoleDemo.run()
				await ReadLineDemo.run()
				await ProgressTestingDemo.run()
			}
		})
	}
	if (demos[choice]) {
		try {
			await (await demos[choice]()).run()
		} catch (error) {
			ui.console.error('Demo error:', error.message)
			ui.console.debug(error.stack)
		}
	} else {
		ui.console.info('Invalid choice. Exiting.')
	}
	process.exit(0)
})
