import type { ColumnDef } from "@tanstack/react-table";

/**
 * Demo 3 — FOUR levels of header groups over THREE levels of expandable rows,
 * to show the component assumes neither depth.
 *
 *   Header tree:  Company Performance ▸ Financial ▸ Revenue ▸ {Q1, Q2}
 *                                                 ▸ Costs   ▸ {COGS, OpEx}
 *                                      ▸ Operational ▸ Customers ▸ {New, Churned}
 *
 *   Row tree:     Division ▸ Department ▸ Team
 */
export interface BudgetRow {
  name: string;
  q1Rev: number;
  q2Rev: number;
  cogs: number;
  opex: number;
  newCust: number;
  churned: number;
  subRows?: BudgetRow[];
}

const k = (n: number) => `$${(n / 1000).toFixed(0)}k`;
const num = (n: number) => n.toLocaleString("en-US");

const curatedBudget: BudgetRow[] = [
  {
    name: "Americas",
    q1Rev: 4200000, q2Rev: 4810000, cogs: 1900000, opex: 1100000, newCust: 5400, churned: 820,
    subRows: [
      {
        name: "Sales",
        q1Rev: 2600000, q2Rev: 3010000, cogs: 1200000, opex: 640000, newCust: 3600, churned: 510,
        subRows: [
          { name: "Enterprise", q1Rev: 1700000, q2Rev: 2010000, cogs: 760000, opex: 380000, newCust: 1400, churned: 160 },
          { name: "SMB", q1Rev: 900000, q2Rev: 1000000, cogs: 440000, opex: 260000, newCust: 2200, churned: 350 },
        ],
      },
      {
        name: "Marketing",
        q1Rev: 1600000, q2Rev: 1800000, cogs: 700000, opex: 460000, newCust: 1800, churned: 310,
        subRows: [
          { name: "Demand Gen", q1Rev: 1100000, q2Rev: 1240000, cogs: 470000, opex: 300000, newCust: 1300, churned: 210 },
          { name: "Brand", q1Rev: 500000, q2Rev: 560000, cogs: 230000, opex: 160000, newCust: 500, churned: 100 },
        ],
      },
    ],
  },
  {
    name: "EMEA",
    q1Rev: 3100000, q2Rev: 3450000, cogs: 1450000, opex: 880000, newCust: 4100, churned: 640,
    subRows: [
      {
        name: "Sales",
        q1Rev: 2100000, q2Rev: 2350000, cogs: 980000, opex: 540000, newCust: 2700, churned: 420,
        subRows: [
          { name: "Enterprise", q1Rev: 1400000, q2Rev: 1580000, cogs: 640000, opex: 320000, newCust: 1000, churned: 130 },
          { name: "SMB", q1Rev: 700000, q2Rev: 770000, cogs: 340000, opex: 220000, newCust: 1700, churned: 290 },
        ],
      },
      {
        name: "Marketing",
        q1Rev: 1000000, q2Rev: 1100000, cogs: 470000, opex: 340000, newCust: 1400, churned: 220,
        subRows: [
          { name: "Demand Gen", q1Rev: 700000, q2Rev: 780000, cogs: 320000, opex: 220000, newCust: 1000, churned: 150 },
          { name: "Brand", q1Rev: 300000, q2Rev: 320000, cogs: 150000, opex: 120000, newCust: 400, churned: 70 },
        ],
      },
    ],
  },
];

// Generated deterministically so the nested table has enough rows to virtualize.
// Expand the divisions to scroll through hundreds of department/team rows.
const DIVISIONS = ["APAC", "LATAM", "MEA", "Nordics", "DACH", "Benelux", "ANZ", "India", "Iberia", "Eastern Europe"];
const DEPTS = ["Sales", "Marketing", "Engineering", "Operations", "Support"];
const TEAMS = ["Enterprise", "SMB", "Demand Gen", "Brand", "Platform", "Field"];

const roll = (i: number, base: number) => base + ((i * 137) % 90) * 10_000;

const team = (i: number, name: string): BudgetRow => ({
  name,
  q1Rev: roll(i, 400_000), q2Rev: roll(i + 1, 450_000),
  cogs: roll(i + 2, 200_000), opex: roll(i + 3, 140_000),
  newCust: 300 + ((i * 37) % 1500), churned: 40 + ((i * 13) % 300),
});

/** Sum children into a parent so rolled-up totals stay consistent. */
const branch = (name: string, subRows: BudgetRow[]): BudgetRow => {
  const sum = (p: (r: BudgetRow) => number) => subRows.reduce((a, r) => a + p(r), 0);
  return {
    name,
    q1Rev: sum((r) => r.q1Rev), q2Rev: sum((r) => r.q2Rev),
    cogs: sum((r) => r.cogs), opex: sum((r) => r.opex),
    newCust: sum((r) => r.newCust), churned: sum((r) => r.churned),
    subRows,
  };
};

const at = <T,>(arr: T[], i: number, salt: number) => arr[(i * 7 + salt * 13) % arr.length];

const generatedBudget: BudgetRow[] = Array.from({ length: 60 }, (_, d) =>
  branch(
    `${at(DIVISIONS, d, 1)} ${d + 1}`,
    Array.from({ length: 3 }, (_, dep) =>
      branch(
        `${at(DEPTS, d + dep, 2)} ${d + 1}.${dep + 1}`,
        Array.from({ length: 3 }, (_, t) => {
          const i = d * 9 + dep * 3 + t;
          return team(i, `${at(TEAMS, i, 3)} ${d + 1}.${dep + 1}.${t + 1}`);
        })
      )
    )
  )
);

export const budgetData: BudgetRow[] = [...curatedBudget, ...generatedBudget];

export const budgetColumns: ColumnDef<BudgetRow>[] = [
  { id: "org", header: "Organization", accessorKey: "name", size: 280 },
  {
    id: "companyPerformance",
    header: "Company Performance",
    columns: [
      {
        id: "financial",
        header: "Financial",
        columns: [
          {
            id: "revenue",
            header: "Revenue",
            columns: [
              { id: "q1Rev", header: "Q1", accessorKey: "q1Rev", cell: (i) => k(i.getValue<number>()) },
              { id: "q2Rev", header: "Q2", accessorKey: "q2Rev", cell: (i) => k(i.getValue<number>()) },
            ],
          },
          {
            id: "costs",
            header: "Costs",
            columns: [
              { id: "cogs", header: "COGS", accessorKey: "cogs", cell: (i) => k(i.getValue<number>()) },
              { id: "opex", header: "OpEx", accessorKey: "opex", cell: (i) => k(i.getValue<number>()) },
            ],
          },
        ],
      },
      {
        id: "operational",
        header: "Operational",
        columns: [
          {
            id: "customers",
            header: "Customers",
            columns: [
              { id: "newCust", header: "New", accessorKey: "newCust", cell: (i) => num(i.getValue<number>()) },
              { id: "churned", header: "Churned", accessorKey: "churned", cell: (i) => num(i.getValue<number>()) },
            ],
          },
        ],
      },
    ],
  },
];
