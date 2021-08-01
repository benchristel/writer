import {EditorView} from "prosemirror-view"
import {EditorState} from "prosemirror-state"
import {DOMParser, Schema} from "prosemirror-model"
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


// SCHEMA ==================================================


const pDOM          = ["p", 0]
const blockquoteDOM = ["blockquote", 0]
const hrDOM         = ["hr"]
const preDOM        = ["pre", ["code", 0]]
const brDOM         = ["br"]
const leftDOM       = ["left", 0]
const rightDOM      = ["right", 0]
const centerDOM     = ["center", 0]
const emDOM         = ["em", 0]
const strongDOM     = ["strong", 0]
const codeDOM       = ["code", 0]

const nodes = {
  doc: {
    content: "block+"
  },

  paragraph: {
    group: "block",
    content: "inline*",
    attrs: {
      indent: {default: "none"},
      margin: {default: "0"},
    },
    parseDOM: [
      {
        tag: "p",
        getAttrs(dom) {
          return {
            indent: dom.getAttribute("indent") || "none",
            margin: dom.getAttribute("margin") || "0"
          }
        },
      },
    ],
    toDOM({attrs: {indent, margin}}) { return ["p", {indent, margin}, 0] }
  },

  blockquote: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{tag: "blockquote"}],
    toDOM() { return blockquoteDOM }
  },

  horizontal_rule: {
    group: "block",
    parseDOM: [{tag: "hr"}],
    toDOM() { return hrDOM }
  },

  heading: {
    group: "block",
    attrs: {level: {default: 1}},
    content: "inline*",
    defining: true,
    parseDOM: [
      {tag: "h1", attrs: {level: 1}},
      {tag: "h2", attrs: {level: 2}},
      {tag: "h3", attrs: {level: 3}},
      {tag: "h4", attrs: {level: 4}},
      {tag: "h5", attrs: {level: 5}},
      {tag: "h6", attrs: {level: 6}},
    ],
    toDOM(node) { return ["h" + node.attrs.level, 0] }
  },

  code_block: {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    parseDOM: [{tag: "pre", preserveWhitespace: "full"}],
    toDOM() { return preDOM }
  },

  text: {
    group: "inline"
  },

  image: {
    inline: true,
    attrs: {
      src: {},
      alt: {default: null},
      title: {default: null}
    },
    group: "inline",
    draggable: true,
    parseDOM: [{tag: "img[src]", getAttrs(dom) {
      return {
        src: dom.getAttribute("src"),
        title: dom.getAttribute("title"),
        alt: dom.getAttribute("alt")
      }
    }}],
    toDOM(node) { let {src, alt, title} = node.attrs; return ["img", {src, alt, title}] }
  },

  hard_break: {
    inline: true,
    group: "inline",
    selectable: false,
    parseDOM: [{tag: "br"}],
    toDOM() { return brDOM }
  }
}

const marks = {
  link: {
    attrs: {
      href: {},
      title: {default: null}
    },
    inclusive: false,
    parseDOM: [{tag: "a[href]", getAttrs(dom) {
      return {href: dom.getAttribute("href"), title: dom.getAttribute("title")}
    }}],
    toDOM(node) { let {href, title} = node.attrs; return ["a", {href, title}, 0] }
  },

  em: {
    parseDOM: [{tag: "i"}, {tag: "em"}, {style: "font-style=italic"}],
    toDOM() { return emDOM }
  },

  strong: {
    parseDOM: [{tag: "strong"},
               {tag: "b", getAttrs: node => node.style.fontWeight != "normal" && null},
               {style: "font-weight", getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null}],
    toDOM() { return strongDOM }
  },

  code: {
    parseDOM: [{tag: "code"}],
    toDOM() { return codeDOM }
  }
}

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

const schema = new Schema({
  nodes: {...nodes, ...tableNodes},
  marks,
})

// COMMANDS ================================================

function transformAttrs(nodeType, getNewAttrs) {
  return function(state, dispatch) {
    let {from, to} = state.selection
    let applicable = false
    let newAttrs = {}
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (applicable) return false
      if (!node.isTextblock) return;
      newAttrs = getNewAttrs(node.attrs)
      if (node.type != nodeType) return;
      if (node.hasMarkup(nodeType, newAttrs)) return;
      applicable = true
    })
    if (!applicable) return false
    if (dispatch) dispatch(state.tr.setBlockType(from, to, nodeType, newAttrs).scrollIntoView())
    return true
  }
}

// MENU ====================================================


function item(label, cmd) {
  return new MenuItem({
    label,
    enable: () => true,
    select: cmd,
    run: cmd,
  })
}

function indentCmd(indentType) {
  return transformAttrs(
    schema.nodes.paragraph,
    ({indent, ...rest}) => ({indent: indentType, ...rest}),
  )
}

function marginCmd(increment) {
  return transformAttrs(
    schema.nodes.paragraph,
    ({margin, ...rest}) => ({
      margin: String(clamp(+margin + increment, 0, 10)),
      ...rest,
    }),
  )
}

const menu = [
  ...buildMenuItems(schema).fullMenu,
  [
    new Dropdown([
      item("No Indent", indentCmd("none")),
      item("Hanging Indent", indentCmd("hanging")),
      item("Increase Margin", marginCmd(1)),
      item("Decrease Margin", marginCmd(-1)),
    ], {label: "Indent"}),
  ],
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

// PLUGINS =================================================

const plugins = [
  tableEditing(),
  keymap({
    "Tab": goToNextCell(1),
    "Shift-Tab": goToNextCell(-1),
    "Enter": addRowAfter,
  }),
  ...exampleSetup({schema, menuContent: menu})
]

// UTILS ===================================================

function clamp(x, min, max) {
  if (x < min) return min
  if (x > max) return max
  return x
}

// MAIN ====================================================

const doc = DOMParser.fromSchema(schema).parse(document.querySelector("#content"))
const state = EditorState.create({doc, plugins: plugins})
const fix = fixTables(state)
if (fix) state = state.apply(fix.setMeta("addToHistory", false))

window.view = new EditorView(document.querySelector("#editor"), {state})

document.execCommand("enableObjectResizing", false, false)
document.execCommand("enableInlineTableEditing", false, false)
