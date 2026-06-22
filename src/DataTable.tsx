import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ExpandedState,
  type Header,
  type Row,
  type Table,
} from "@tanstack/react-table";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

const ROOT = "__root__";

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Returns the child rows for a given row (enables expansion). */
  getSubRows?: (row: T) => T[] | undefined;
  /** Column that hosts the expand/collapse control. Defaults to the first column. */
  expanderColumnId?: string;
}

/**
 * Move a contiguous block of leaf column ids (`movingIds`) so it lands next to
 * the `targetIds` block. Both blocks belong to siblings under the same parent,
 * which keeps header groups intact while reordering.
 */
function reorderLeafBlock(
  order: string[],
  movingIds: string[],
  targetIds: string[]
): string[] {
  const moving = new Set(movingIds);
  const goingRight = order.indexOf(movingIds[0]) < order.indexOf(targetIds[0]);

  const without = order.filter((id) => !moving.has(id));
  const targetFirst = without.indexOf(targetIds[0]);
  const targetLast = without.indexOf(targetIds[targetIds.length - 1]);
  const insertAt = goingRight ? targetLast + 1 : targetFirst;

  return [
    ...without.slice(0, insertAt),
    ...movingIds,
    ...without.slice(insertAt),
  ];
}

interface HeaderMeta {
  parentId: string;
  leafIds: string[];
}

function headerMeta<T>(header: Header<T, unknown>): HeaderMeta {
  return {
    parentId: header.column.parent?.id ?? ROOT,
    leafIds: header.column.getLeafColumns().map((c) => c.id),
  };
}

function DraggableHeader<T>({
  header,
  draggable,
}: {
  header: Header<T, unknown>;
  draggable: boolean;
}) {
  const meta = headerMeta(header);

  const { attributes, listeners, setNodeRef: dragRef } = useDraggable({
    id: header.id,
    data: meta,
    disabled: !draggable,
  });

  // Every header is also a drop zone; the cursor crossing it reorders live.
  const { setNodeRef: dropRef } = useDroppable({ id: header.id, data: meta });

  return (
    <th
      ref={dropRef}
      colSpan={header.colSpan}
      className={["th", draggable ? "th--draggable" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {header.isPlaceholder ? null : (
        <div className="th__inner" ref={dragRef}>
          {draggable && (
            <span
              className="grip"
              {...attributes}
              {...listeners}
              title="Drag to reorder"
            >
              ⠿
            </span>
          )}
          <span className="th__label">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        </div>
      )}
    </th>
  );
}

function ExpanderCell<T>({
  row,
  children,
}: {
  row: Row<T>;
  children: React.ReactNode;
}) {
  return (
    <div className="expander" style={{ paddingLeft: row.depth * 22 }}>
      {row.getCanExpand() ? (
        <button
          type="button"
          className="expander__btn"
          onClick={row.getToggleExpandedHandler()}
          aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
        >
          {row.getIsExpanded() ? "▾" : "▸"}
        </button>
      ) : (
        <span className="expander__leaf" />
      )}
      <span className="expander__label">{children}</span>
    </div>
  );
}

export function DataTable<T>({
  data,
  columns,
  getSubRows,
  expanderColumnId,
}: DataTableProps<T>) {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [activeHeaderId, setActiveHeaderId] = useState<string | null>(null);

  const table: Table<T> = useReactTable({
    data,
    columns,
    state: { columnOrder, expanded },
    onColumnOrderChange: setColumnOrder,
    onExpandedChange: setExpanded,
    getSubRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // Only designate an expander column when the caller opted into row nesting.
  // Without `getSubRows` the table renders perfectly flat — no indentation, no
  // expand control — so the same component serves flat and nested data alike.
  const expanderId = getSubRows
    ? expanderColumnId ?? table.getAllLeafColumns()[0]?.id
    : undefined;

  const dragging = activeHeaderId !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveHeaderId(String(event.active.id));
  }

  // The cursor only decides order: as it crosses a sibling header, reorder the
  // real columns in place. Nothing detaches — the table itself rearranges live.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const a = active.data.current as HeaderMeta | undefined;
    const o = over.data.current as HeaderMeta | undefined;
    if (!a || !o || a.parentId !== o.parentId) return;

    setColumnOrder((prev) => {
      const order = prev.length
        ? prev
        : table.getAllLeafColumns().map((c) => c.id);
      const next = reorderLeafBlock(order, a.leafIds, o.leafIds);
      // Avoid pointless state churn when the order is already correct.
      return next.length === order.length &&
        next.every((id, i) => id === order[i])
        ? order
        : next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={() => setActiveHeaderId(null)}
      onDragCancel={() => setActiveHeaderId(null)}
    >
      <div className={`table-wrap ${dragging ? "table-wrap--dragging" : ""}`}>
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <DraggableHeader
                    key={header.id}
                    header={header}
                    draggable={
                      !header.isPlaceholder &&
                      header.column
                        .getLeafColumns()
                        .every((c) => c.id !== expanderId)
                    }
                  />
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={`row row--depth-${row.depth}`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="td">
                    {cell.column.id === expanderId ? (
                      <ExpanderCell row={row}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </ExpanderCell>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}
