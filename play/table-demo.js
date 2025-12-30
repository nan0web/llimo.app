import { Table } from '../src/cli/components/Table.js'
import Ui from '../src/cli/Ui.js'

export class TableDemo {
	static async run() {
		const ui = new Ui()

		console.log('=== Table Component Demo ===')

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
		console.log('Basic Table:')
		basicTable.renderIn(ui)
		console.log('')

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
		console.log('Advanced Table:')
		advancedTable.renderIn(ui)
		console.log('')

		// Rendering without UI (toString)
		const stringTable = new Table({ rows: [["A", "B"]] })
		console.log('As String:', stringTable.toString())

		// Silent table (no console output)
		const silentTable = new Table({ rows: [["Silent", "Row"]] })
		silentTable.renderIn(ui) // No output due to silent: false by default, but can set options.silent=true

		console.log('Demo complete!')
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	TableDemo.run().catch(console.error)
}
