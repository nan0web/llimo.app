import { Table } from '../src/cli/components/Table.js'
import Ui from '../src/cli/Ui.js'

export class TableDemo {
	static async run() {
		const ui = new Ui()

		console.info('=== Table Component Demo ===')

		// Basic table
		const basicTable = new Table({
			rows: [
				["Name", "Age", "City"],
				["Alice", 30, "NYC"],
				["Bob", 25, "LA"],
				["Charlie", 35, "SF"]
			],
			options: { divider: " | ", aligns: ["left", "right", "left"] }
		})
		console.info('Basic Table:')
		ui.render(basicTable)
		console.info('')

		// Advanced options
		const advancedTable = new Table({
			rows: [
				["Item", "Price", "Qty"],
				["Apple", "$1.00", 5],
				["Banana", "$0.50", 10],
				["Cherry", "$2.00", 3]
			],
			options: {
				divider: " | ",
				aligns: ["left", "right", "right"],
				overflow: "visible" // or "hidden"
			}
		})
		console.info('Advanced Table:')
		ui.render(advancedTable)
		console.info('')

		// Rendering without UI (toString)
		console.info('Rendering without UI (toString):')
		console.info(String(advancedTable))

		// Silent table (no console output)
		const silentTable = new Table({ rows: [["Silent", "Row"]] })
		ui.render(silentTable) // No output due to silent: false by default, but can set options.silent=true

		console.info('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	TableDemo.run().catch(console.error)
}
