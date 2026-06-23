import { useEffect, useMemo, useRef, useState } from "react";
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
  type VisibilityState,
} from "@tanstack/react-table";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

const ROOT = "__root__";

/**
 * Persisted, emitted state for a single **leaf** column (parent/group headers are
 * deliberately excluded — only the columns that actually hold data appear here).
 * This is the shape stored under `storageKey` and handed to `onColumnConfigChange`
 * whenever the user resizes, reorders, or hides/shows a column.
 */
export interface LeafColumnConfig {
  /** Stable column id — the key used to restore order/visibility/width. */
  id: string;
  /** The column's header label (its display name). */
  header: string;
  /** True when the column is currently hidden from the grid. */
  hidden: boolean;
  /** Zero-based position of the column in the current left-to-right order. */
  order: number;
  /** Current column width in px, so resizes survive a reload. */
  width: number;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Returns the child rows for a given row (enables expansion). */
  getSubRows?: (row: T) => T[] | undefined;
  /** Column that hosts the expand/collapse control. Defaults to the first column. */
  expanderColumnId?: string;
  /**
   * Leaf column ids that may never be hidden. Their checkbox in the column
   * chooser is locked on. The expander column is always treated as unhidable.
   */
  unhidableColumns?: string[];
  /**
   * When set, the leaf-column config (order, visibility, width) is persisted to
   * `localStorage` under this key and restored on mount. Omit to keep the table
   * stateless across reloads.
   */
  storageKey?: string;
  /**
   * Called with the full leaf-column config whenever the user resizes, reorders,
   * or hides/shows a column (and once on mount with the initial state), so the
   * consumer can react to layout changes.
   */
  onColumnConfigChange?: (config: LeafColumnConfig[]) => void;
  /**
   * Optional cap (px) on the scrolling/virtualized body's height. When omitted,
   * the body fills whatever vertical space its flex container leaves it, so the
   * grid always spans the available area even when the data is short on rows.
   */
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

  const { attributes, listeners, setNodeRef: dragRef, isDragging } =
    useDraggable({
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
        isDragging ? "th--dragging" : "",
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

/**
 * A floating popover (Floating UI) anchored to a top-right button that lists
 * every leaf column with a checkbox to show/hide it. Columns in `unhidable` are
 * locked on. Toggling here flips the table's column-visibility state, which the
 * persistence/emit effect below picks up like any other change.
 */
function ColumnChooser<T>({
  table,
  unhidable,
}: {
  table: Table<T>;
  unhidable: Set<string>;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  const leafColumns = table.getAllLeafColumns();
  const hiddenCount = leafColumns.filter((c) => !c.getIsVisible()).length;

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        className={`col-chooser__btn ${open ? "col-chooser__btn--open" : ""}`}
        {...getReferenceProps()}
      >
        <span aria-hidden>▦</span> Columns
        {hiddenCount > 0 && (
          <span className="col-chooser__badge">{hiddenCount} hidden</span>
        )}
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              className="col-chooser__panel"
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <div className="col-chooser__title">Show columns</div>
              {leafColumns.map((column) => {
                const locked = unhidable.has(column.id);
                const label =
                  typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id;
                return (
                  <label key={column.id} className="col-chooser__item">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      disabled={locked}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    <span className="col-chooser__item-label">{label}</span>
                    {locked && (
                      <span className="col-chooser__lock" aria-hidden>
                        🔒
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

/** Read a persisted leaf-column config array from localStorage, if any. */
function loadStoredConfig(storageKey?: string): LeafColumnConfig[] | null {
  if (!storageKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LeafColumnConfig[]) : null;
  } catch {
    return null;
  }
}

export function DataTable<T>({
  data,
  columns,
  getSubRows,
  expanderColumnId,
  unhidableColumns,
  storageKey,
  onColumnConfigChange,
  maxHeight,
  estimateRowHeight = 37,
}: DataTableProps<T>) {
  // Restore any persisted layout once, before the first render, so the table
  // mounts already in its saved order / visibility / sizing.
  const stored = useMemo(() => loadStoredConfig(storageKey), [storageKey]);

  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    () => stored?.map((c) => c.id) ?? []
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const sizing: ColumnSizingState = {};
    stored?.forEach((c) => {
      if (typeof c.width === "number") sizing[c.id] = c.width;
    });
    return sizing;
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      const visibility: VisibilityState = {};
      stored?.forEach((c) => {
        if (c.hidden) visibility[c.id] = false;
      });
      return visibility;
    }
  );
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [activeHeaderId, setActiveHeaderId] = useState<string | null>(null);

  const table: Table<T> = useReactTable({
    data,
    columns,
    state: { columnOrder, columnSizing, columnVisibility, expanded },
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
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

  // Columns the chooser must never let the user hide: caller-supplied ones plus
  // the expander column (hiding it would strip every row's expand control).
  const unhidable = useMemo(() => {
    const set = new Set(unhidableColumns ?? []);
    if (expanderId) set.add(expanderId);
    return set;
  }, [unhidableColumns, expanderId]);

  // ── Persist & emit leaf-column config ──
  // Build the canonical leaf-only config (parents/groups excluded) from the
  // current order, visibility and sizing, then persist it under `storageKey` and
  // hand it to the consumer. Runs after every resize / reorder / hide-show — and
  // once on mount — because it depends on exactly those three state slices.
  useEffect(() => {
    const orderedIds = columnOrder.length
      ? columnOrder
      : table.getAllLeafColumns().map((c) => c.id);

    const config: LeafColumnConfig[] = orderedIds.flatMap((id, index) => {
      const column = table.getColumn(id);
      if (!column) return [];
      const header =
        typeof column.columnDef.header === "string"
          ? column.columnDef.header
          : id;
      return [
        {
          id,
          header,
          hidden: !column.getIsVisible(),
          order: index,
          width: column.getSize(),
        },
      ];
    });

    if (storageKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(config));
      } catch {
        // Ignore quota / privacy-mode write failures — persistence is best-effort.
      }
    }
    onColumnConfigChange?.(config);
    // `table` is stable across renders; the three state slices are the real
    // triggers, and re-running on an unstable `onColumnConfigChange` identity
    // would emit far more often than the documented resize/reorder/hide-show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnOrder, columnVisibility, columnSizing, storageKey]);

  const dragging = activeHeaderId !== null;

  const headerGroups = table.getHeaderGroups();
  const headerDepth = headerGroups.length;

  // The header currently being dragged, looked up across every header row so the
  // floating drag ghost (below) can mirror its label while the real columns
  // reorder live underneath the cursor.
  const activeHeader =
    activeHeaderId != null
      ? headerGroups
          .flatMap((group) => group.headers)
          .find((header) => header.id === activeHeaderId) ?? null
      : null;

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
      // Reorder the instant the cursor crosses a column boundary: `pointerWithin`
      // reports the header the pointer currently sits inside, so `over` flips to
      // a neighbor the moment the drag passes that neighbor's near edge — the
      // left edge of the column to the right, or the right edge of the column to
      // the left. The default `rectIntersection` instead waits for the dragged
      // cell's *box* to overlap a neighbor by more than half, which reads as lag.
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={() => setActiveHeaderId(null)}
      onDragCancel={() => setActiveHeaderId(null)}
    >
      {/* Toolbar above the grid; the column chooser sits at the top-right. */}
      <div className="table-toolbar">
        <ColumnChooser table={table} unhidable={unhidable} />
      </div>

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
              // No fixed height: the scroller fills its flex container (see the
              // .table-body-scroll rule) so the grid always spans the available
              // space, even when there aren't enough rows to fill it. `maxHeight`
              // only applies when the caller asks to cap the body.
              style={{
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

      {/* AG-Grid-style floating duplicate of the dragged column header. dnd-kit
          renders it in a portal sized to the source header, so it rides with the
          cursor above everything (never clipped by the table's overflow) while
          the real columns reorder live underneath. dropAnimation is disabled so
          the ghost simply vanishes on release — the column is already in place. */}
      <DragOverlay dropAnimation={null}>
        {activeHeader ? (
          <div className="col-drag-ghost">
            <span className="grip">⠿</span>
            <span className="col-drag-ghost__label">
              {flexRender(
                activeHeader.column.columnDef.header,
                activeHeader.getContext()
              )}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
