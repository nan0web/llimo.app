import BashCommand from "./BashCommand.js"
import GetFilesCommand from "./GetFilesCommand.js"
import ListFilesCommand from "./ListFilesCommand.js"
import RemoveCommand from "./RemoveCommand.js"
import SummaryCommand from "./SummaryCommand.js"
import ValidateCommand from "./ValidateCommand.js"

/** @type {Map<string, typeof import("./Command.js").default>} */
const commands = new Map([
	[ValidateCommand.name, ValidateCommand],
	[ListFilesCommand.name, ListFilesCommand],
	[GetFilesCommand.name, GetFilesCommand],
	[BashCommand.name, BashCommand],
	[RemoveCommand.name, RemoveCommand],
	[SummaryCommand.name, SummaryCommand],
])

export default commands
