import { DataTable } from "./DataTable";
import { columns } from "./columns";
import { salesData, type SalesRow } from "./data";

export function App() {
  return (
    <div className="page">
      <header className="page__head">
        <h1>Global Retail — Sales Analytics</h1>
        <p>
          Expand rows to drill down <strong>Region ▸ Country ▸ City ▸ Store</strong>{" "}
          (4 levels). Grab any header by its <span className="grip-inline">⠿</span>{" "}
          handle to reorder columns — drag a top-level group to move the whole
          block, or a leaf to swap within its group.
        </p>
      </header>

      <DataTable<SalesRow>
        data={salesData}
        columns={columns}
        getSubRows={(row) => row.subRows}
        expanderColumnId="location"
      />
    </div>
  );
}
