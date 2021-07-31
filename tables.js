function noop() {}

export function createTable(state, dispatch = noop) {
  dispatch(
    state.tr
      .replaceSelectionWith(createTableNode(state.schema))
      .scrollIntoView()
  )
  return true
}

const createTableNode = (
  schema,
  rowsCount = 3,
  colsCount = 3,
) => {
  const {
    cell: tableCell,
    header_cell: tableHeader,
    row: tableRow,
    table
  } = tableNodeTypes(schema)

  const cells = [];
  const headerCells = [];
  for (let i = 0; i < colsCount; i++) {
    cells.push(tableCell.createAndFill())
  }

  const rows = [];
  for (let i = 0; i < rowsCount; i++) {
    rows.push(
      tableRow.createChecked(
        null,
        cells,
      )
    )
  }

  return table.createChecked(null, rows);
};

const tableNodeTypes = schema => {
  if (schema.cached.tableNodeTypes) {
    return schema.cached.tableNodeTypes;
  }
  const roles = {};
  Object.keys(schema.nodes).forEach(type => {
    const nodeType = schema.nodes[type];
    if (nodeType.spec.tableRole) {
      roles[nodeType.spec.tableRole] = nodeType;
    }
  });
  schema.cached.tableNodeTypes = roles;
  return roles;
};
