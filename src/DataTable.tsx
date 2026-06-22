import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
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
  /** Viewport height (px) for the scrolling/virtualized body. Defaults to 460. */
  maxHeight?: number;
  /** Estimated row height (px) used to seed the virtualizer. Defaults to 37. */
  estimateRowHeight?: number;
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
  rowSpan,
  showContent,
}: {
  header: Header<T, unknown>;
  draggable: boolean;
  /** When set, the cell spans this many header rows (see `isFullSpanColumn`). */
  rowSpan?: number;
  /** Whether to render the label; false for the empty placeholder cells. */
  showContent: boolean;
}) {
  const meta = headerMeta(header);

  const { attributes, listeners, setNodeRef: dragRef } = useDraggable({
    id: header.id,
    data: meta,
    disabled: !draggable,
  });

  // Every header is also a drop zone; the cursor crossing it reorders live.
  const { setNodeRef: dropRef } = useDroppable({ id: header.id, data: meta });

  // A header can be resized when content is visible and the column allows it.
  // Grouped headers resize their full span; leaf headers resize one column.
  const canResize = showContent && header.column.getCanResize();
  const isResizing = header.column.getIsResizing();

  return (
    <th
      ref={dropRef}
      colSpan={header.colSpan}
      rowSpan={rowSpan}
      // Width comes from the <colgroup>; cells must not set their own width or
      // grouped colSpan headers would reintroduce sibling redistribution.
      className={[
        "th",
        draggable ? "th--draggable" : "",
        rowSpan ? "th--span-all" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showContent ? (
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
      ) : null}
      {canResize && (
        <span
          // Sits on the cell's right edge; dragging it resizes the column.
          // dnd-kit only listens on the grip, so this never starts a reorder.
          className={`resizer ${isResizing ? "resizer--active" : ""}`}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onDoubleClick={() => header.column.resetSize()}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize · double-click to reset"
        />
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
  maxHeight = 460,
  estimateRowHeight = 37,
}: DataTableProps<T>) {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [activeHeaderId, setActiveHeaderId] = useState<string | null>(null);

  const table: Table<T> = useReactTable({
    data,
    columns,
    state: { columnOrder, columnSizing, expanded },
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onExpandedChange: setExpanded,
    getSubRows,
    // Resize live as the handle moves, rather than only on release.
    columnResizeMode: "onChange",
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

  const headerGroups = table.getHeaderGroups();
  const headerDepth = headerGroups.length;

  // ── Row virtualization ──
  // The scroll viewport is the `.table-wrap` element. Only the rows inside the
  // window (plus a small overscan) are mounted; everything above and below is
  // accounted for by two spacer rows whose heights stand in for the unmounted
  // rows, so the scrollbar and total height stay correct.
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
    // Measure each mounted row so variable heights (wrapped text, nested rows)
    // stay accurate instead of trusting the estimate.
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (el) => el?.getBoundingClientRect().height
        : undefined,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = table.getTotalSize();
  // Height of the unmounted rows above the first / below the last visible row.
  const paddingTop = virtualRows.length ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length
    ? totalHeight - virtualRows[virtualRows.length - 1].end
    : 0;
  const leafCount = table.getVisibleLeafColumns().length;

  // A top-level column with no parent and no child columns naturally lives in
  // the very first header row, with empty placeholder cells stacked beneath it
  // wherever the grouped columns go deeper. Instead of those blanks, render such
  // a column once and let it `rowSpan` the full header depth so its label reads
  // as a single tall cell aligned with the grouped headers.
  const isFullSpanColumn = (header: Header<T, unknown>) =>
    headerDepth > 1 &&
    !header.column.parent &&
    header.column.columns.length === 0;

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
      {/* One <col> per leaf column is the single source of truth for column
          widths. Under `table-layout: fixed` these per-column widths take
          priority and are unambiguous — unlike cell widths, which the browser
          derives from the first row only and divides equally across grouped
          `colSpan` headers, causing a resize to reflow a column's siblings.
          Resizing one column rewrites just its <col>, so no other moves. The
          header and body are separate tables, so each carries its own copy. */}
      {(() => {
        const colgroup = (
          <colgroup>
            {table.getVisibleLeafColumns().map((col) => (
              <col key={col.id} style={{ width: col.getSize() }} />
            ))}
          </colgroup>
        );
        return (
          // The outer wrap owns horizontal scroll only, so the header and body
          // tables slide together and stay column-aligned. Vertical scroll lives
          // on the inner body element alone — that keeps the vertical scrollbar
          // beside the rows instead of running the full height past the header.
          <div
            className={`table-wrap ${dragging ? "table-wrap--dragging" : ""}`}
          >
            <table
              className="table table--head"
              style={{ width: totalWidth }}
            >
              {colgroup}
              <thead>
                {headerGroups.map((headerGroup, rowIndex) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const fullSpan = isFullSpanColumn(header);
                      // A full-span column is emitted once, in the first row only.
                      if (fullSpan && rowIndex !== 0) return null;

                      const showContent = !header.isPlaceholder || fullSpan;
                      return (
                        <DraggableHeader
                          key={header.id}
                          header={header}
                          rowSpan={fullSpan ? headerDepth : undefined}
                          showContent={showContent}
                          // A full-span column is a top-level sibling that should
                          // reorder among the other level-0 columns like any other
                          // header — even when it doubles as the expander column,
                          // which is otherwise locked in place.
                          draggable={
                            showContent &&
                            (fullSpan ||
                              header.column
                                .getLeafColumns()
                                .every((c) => c.id !== expanderId))
                          }
                        />
                      );
                    })}
                  </tr>
                ))}
              </thead>
            </table>
            <div
              ref={scrollRef}
              className="table-body-scroll"
              // Seed a real height from the virtualizer's total size (capped by
              // maxHeight). Without it the scroller would start at zero height —
              // the header that used to seed it now lives in a separate table —
              // and a zero-height viewport makes the virtualizer render no rows.
              style={{
                height: totalHeight,
                maxHeight,
                width: totalWidth,
              }}
            >
              <table
                className="table table--body"
                style={{ width: totalWidth }}
              >
                {colgroup}
                <tbody>
                  {/* Top spacer: stands in for the rows scrolled off above. */}
                  {paddingTop > 0 && (
                    <tr aria-hidden className="row-spacer">
                      <td colSpan={leafCount} style={{ height: paddingTop }} />
                    </tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        // Let the virtualizer measure real heights and locate rows.
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className={`row row--depth-${row.depth}`}
                      >
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
                              flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {/* Bottom spacer: stands in for the rows scrolled off below. */}
                  {paddingBottom > 0 && (
                    <tr aria-hidden className="row-spacer">
                      <td
                        colSpan={leafCount}
                        style={{ height: paddingBottom }}
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </DndContext>
  );
}
