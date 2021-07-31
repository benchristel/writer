import {EditorView} from "prosemirror-view"
import {EditorState} from "prosemirror-state"
import {DOMParser, Schema} from "prosemirror-model"
import {schema as baseSchema} from "prosemirror-schema-basic"
import {baseKeymap} from "prosemirror-commands"
import {keymap} from "prosemirror-keymap"
import {exampleSetup, buildMenuItems} from "prosemirror-example-setup"
import {MenuItem, Dropdown} from "prosemirror-menu"
import {createTable} from "./tables.js"
import {
  addColumnAfter, addColumnBefore, deleteColumn,
  addRowAfter, addRowBefore, deleteRow, mergeCells,
  splitCell, setCellAttr, toggleHeaderRow,
  toggleHeaderColumn, toggleHeaderCell, goToNextCell,
  deleteTable, tableEditing, columnResizing,
  tableNodes as configureTableNodes, fixTables,
} from "prosemirror-tables"

const tableNodes = configureTableNodes({
  tableGroup: "block",
  cellContent: "paragraph",
  cellAttributes: {
    green: {
      default: "false",
      getFromDOM: dom => dom.getAttribute("green") === "true",
      setDOMAttr: (value, attrs) => attrs.green = String(value),
    }
  }
})

console.log(baseSchema.spec.nodes)

const schema = new Schema({
  nodes: baseSchema.spec.nodes
    .append(tableNodes)
    .remove("blockquote"),
  marks: baseSchema.spec.marks,
})

function item(label, cmd) {
  return new MenuItem({
    label,
    enable: () => true,
    select: cmd,
    run: cmd,
  })
}

const menu = [
  ...buildMenuItems(schema).fullMenu,
  [
    new Dropdown([
      item("Add Table", createTable),
      item("Add Row", addRowAfter),
      item("Add Column", addColumnAfter),
      item("Delete Table", deleteTable),
      item("Delete Column", deleteColumn),
      item("Delete Row", deleteRow),
      item("Merge Cells", mergeCells),
      item("Split Cells", splitCell),
      item("Add Highlight", setCellAttr("green", "true")),
      item("Remove Highlight", setCellAttr("green", "false"))
    ], {label: "Table"}),
  ]
]

const plugins = [
  tableEditing(),
  keymap({
    "Tab": goToNextCell(1),
    "Shift-Tab": goToNextCell(-1),
    "Enter": addRowAfter,
  }),
  ...exampleSetup({schema, menuContent: menu})
]

const doc = DOMParser.fromSchema(schema).parse(document.querySelector("#content"))
const state = EditorState.create({doc, plugins: plugins})
const fix = fixTables(state)
if (fix) state = state.apply(fix.setMeta("addToHistory", false))

window.view = new EditorView(document.querySelector("#editor"), {state})

document.execCommand("enableObjectResizing", false, false)
document.execCommand("enableInlineTableEditing", false, false)
