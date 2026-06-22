import type { ColumnDef } from "@tanstack/react-table";
import type { SalesRow } from "./data";

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const count = (n: number) => n.toLocaleString("en-US");
const pct = (n: number) => `${n.toFixed(1)}%`;

/**
 * Three levels of header groups:
 *
 *   ┌──────────────────────── Sales Performance ────────────────────────┐┌───── Profitability ─────┐
 *   │      Revenue       │        Volume          │        Margin        ││ (spans Net Profit leaf) │
 *   │ Gross   │   Net    │ Units Sold │ Returns   │ Gross %  │ Oper. %   ││       Net Profit        │
 *
 * The leading "Location" column is the expander column and is excluded from
 * drag reordering by the table component.
 */
export const columns: ColumnDef<SalesRow>[] = [
  {
    id: "location",
    header: "Location",
    // Cell is rendered by the table component so it can inject the expander.
    accessorFn: (row) => row.name,
    size: 320,
  },
  {
    id: "salesPerformance",
    header: "Sales Performance",
    columns: [
      {
        id: "revenue",
        header: "Revenue",
        columns: [
          {
            id: "grossRevenue",
            header: "Gross",
            accessorKey: "grossRevenue",
            cell: (info) => usd(info.getValue<number>()),
          },
          {
            id: "netRevenue",
            header: "Net",
            accessorKey: "netRevenue",
            cell: (info) => usd(info.getValue<number>()),
          },
        ],
      },
      {
        id: "volume",
        header: "Volume",
        columns: [
          {
            id: "unitsSold",
            header: "Units Sold",
            accessorKey: "unitsSold",
            cell: (info) => count(info.getValue<number>()),
          },
          {
            id: "returns",
            header: "Returns",
            accessorKey: "returns",
            cell: (info) => count(info.getValue<number>()),
          },
        ],
      },
    ],
  },
  {
    id: "profitability",
    header: "Profitability",
    columns: [
      {
        id: "margin",
        header: "Margin",
        columns: [
          {
            id: "grossMargin",
            header: "Gross %",
            accessorKey: "grossMargin",
            cell: (info) => pct(info.getValue<number>()),
          },
          {
            id: "operatingMargin",
            header: "Operating %",
            accessorKey: "operatingMargin",
            cell: (info) => pct(info.getValue<number>()),
          },
        ],
      },
      {
        id: "netProfit",
        header: "Net Profit",
        accessorKey: "netProfit",
        cell: (info) => usd(info.getValue<number>()),
      },
    ],
  },
];
