import type { ColumnDef } from "@tanstack/react-table";

/**
 * Demo 2 — a completely flat dataset with single-level headers and no row
 * nesting. The same <DataTable> renders it with no expander column at all,
 * because no `getSubRows` is passed.
 */
export interface Employee {
  name: string;
  role: string;
  team: string;
  location: string;
  startDate: string;
}

export const employees: Employee[] = [
  { name: "Ava Thompson", role: "Staff Engineer", team: "Platform", location: "Austin, US", startDate: "2019-03-11" },
  { name: "Liam Chen", role: "Product Designer", team: "Growth", location: "Toronto, CA", startDate: "2021-07-26" },
  { name: "Noah Müller", role: "Engineering Manager", team: "Payments", location: "Berlin, DE", startDate: "2018-01-15" },
  { name: "Sofia Rossi", role: "Data Scientist", team: "Insights", location: "Milan, IT", startDate: "2022-09-05" },
  { name: "Yuki Tanaka", role: "Frontend Engineer", team: "Web", location: "Tokyo, JP", startDate: "2020-11-02" },
  { name: "Maya Patel", role: "Product Manager", team: "Growth", location: "London, UK", startDate: "2017-05-20" },
];

export const employeeColumns: ColumnDef<Employee>[] = [
  { id: "name", header: "Name", accessorKey: "name", size: 220 },
  { id: "role", header: "Role", accessorKey: "role", size: 200 },
  { id: "team", header: "Team", accessorKey: "team" },
  { id: "location", header: "Location", accessorKey: "location" },
  { id: "startDate", header: "Start Date", accessorKey: "startDate" },
];
