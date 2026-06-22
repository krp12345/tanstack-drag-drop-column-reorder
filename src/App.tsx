import type { ReactNode } from "react";
import { DataTable } from "./DataTable";
import { columns } from "./columns";
import { salesData, type SalesRow } from "./data";
import { employeeColumns, employees } from "./demos/directory";
import { budgetColumns, budgetData } from "./demos/budget";

function Demo({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <section className="demo">
      <div className="demo__head">
        <h2>{title}</h2>
        <span className="demo__meta">{meta}</span>
      </div>
      {children}
    </section>
  );
}

export function App() {
  return (
    <div className="page">
      <header className="page__head">
        <h1>One generic &lt;DataTable&gt;, three shapes</h1>
        <p>
          The same component drives every table below. It assumes nothing about
          how many header levels exist or how deep rows nest — drag any{" "}
          <span className="grip-inline">⠿</span> handle to reorder columns; click{" "}
          <strong>▸</strong> to drill in where rows nest.
        </p>
      </header>

      <Demo
        title="Retail Sales Analytics"
        meta="3 header levels · 4 row levels (Region ▸ Country ▸ City ▸ Store)"
      >
        <DataTable<SalesRow>
          data={salesData}
          columns={columns}
          getSubRows={(row) => row.subRows}
          expanderColumnId="location"
        />
      </Demo>

      <Demo
        title="Employee Directory"
        meta="1 header level · flat rows (no getSubRows → no expander)"
      >
        <DataTable data={employees} columns={employeeColumns} />
      </Demo>

      <Demo
        title="Budget Breakdown"
        meta="4 header levels · 3 row levels (Division ▸ Department ▸ Team)"
      >
        <DataTable
          data={budgetData}
          columns={budgetColumns}
          getSubRows={(row) => row.subRows}
          expanderColumnId="org"
        />
      </Demo>
    </div>
  );
}
