import { useSyncExternalStore, type ReactNode } from "react";
import { DataTable } from "./DataTable";
import { columns } from "./columns";
import { salesData, type SalesRow } from "./data";
import { employeeColumns, employees } from "./demos/directory";
import { budgetColumns, budgetData } from "./demos/budget";
import { people, peopleColumns } from "./demos/people";

type Route = {
  id: string;
  label: string;
  title: string;
  meta: string;
  render: () => ReactNode;
};

const routes: Route[] = [
  {
    id: "sales",
    label: "Retail Sales",
    title: "Retail Sales Analytics",
    meta: "3 header levels · 4 row levels (Region ▸ Country ▸ City ▸ Store)",
    render: () => (
      <DataTable<SalesRow>
        data={salesData}
        columns={columns}
        getSubRows={(row) => row.subRows}
        expanderColumnId="location"
      />
    ),
  },
  {
    id: "directory",
    label: "Employee Directory",
    title: "Employee Directory",
    meta: "1 header level · flat rows (no getSubRows → no expander)",
    render: () => <DataTable data={employees} columns={employeeColumns} />,
  },
  {
    id: "budget",
    label: "Budget",
    title: "Budget Breakdown",
    meta: "4 header levels · 3 row levels (Division ▸ Department ▸ Team)",
    render: () => (
      <DataTable
        data={budgetData}
        columns={budgetColumns}
        getSubRows={(row) => row.subRows}
        expanderColumnId="org"
      />
    ),
  },
  {
    id: "people",
    label: "People",
    title: "People (Virtualized)",
    meta: "10,000 flat rows · only the visible window is mounted",
    render: () => <DataTable data={people} columns={peopleColumns} />,
  },
];

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashRoute() {
  return window.location.hash.replace(/^#\/?/, "");
}

function useRoute(): Route {
  const id = useSyncExternalStore(subscribe, getHashRoute);
  return routes.find((route) => route.id === id) ?? routes[0];
}

export function App() {
  const active = useRoute();

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

      <nav className="tabs">
        {routes.map((route) => (
          <a
            key={route.id}
            href={`#/${route.id}`}
            className={
              route.id === active.id ? "tabs__btn tabs__btn--active" : "tabs__btn"
            }
            aria-current={route.id === active.id ? "page" : undefined}
          >
            {route.label}
          </a>
        ))}
      </nav>

      <section className="demo">
        <div className="demo__head">
          <h2>{active.title}</h2>
          <span className="demo__meta">{active.meta}</span>
        </div>
        {active.render()}
      </section>
    </div>
  );
}
