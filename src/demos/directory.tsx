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

const seedEmployees: Employee[] = [
  { name: "Ava Thompson", role: "Staff Engineer", team: "Platform", location: "Austin, US", startDate: "2019-03-11" },
  { name: "Liam Chen", role: "Product Designer", team: "Growth", location: "Toronto, CA", startDate: "2021-07-26" },
  { name: "Noah Müller", role: "Engineering Manager", team: "Payments", location: "Berlin, DE", startDate: "2018-01-15" },
  { name: "Sofia Rossi", role: "Data Scientist", team: "Insights", location: "Milan, IT", startDate: "2022-09-05" },
  { name: "Yuki Tanaka", role: "Frontend Engineer", team: "Web", location: "Tokyo, JP", startDate: "2020-11-02" },
  { name: "Maya Patel", role: "Product Manager", team: "Growth", location: "London, UK", startDate: "2017-05-20" },
];

// Generated deterministically so the flat table has enough rows to virtualize.
const FIRST = ["Ava", "Liam", "Noah", "Sofia", "Yuki", "Maya", "Omar", "Elena", "Mateo", "Priya", "Hugo", "Nina"];
const LAST = ["Thompson", "Chen", "Müller", "Rossi", "Tanaka", "Patel", "Haddad", "Novak", "Garcia", "Sharma"];
const ROLES = ["Staff Engineer", "Product Designer", "Engineering Manager", "Data Scientist", "Frontend Engineer", "Product Manager", "QA Lead", "DevOps Engineer"];
const TEAMS = ["Platform", "Growth", "Payments", "Insights", "Web", "Infrastructure", "Design", "Mobile"];
const LOCATIONS = ["Austin, US", "Toronto, CA", "Berlin, DE", "Milan, IT", "Tokyo, JP", "London, UK", "Madrid, ES", "Sydney, AU"];

const at = <T,>(arr: T[], i: number, salt: number) => arr[(i * 7 + salt * 13) % arr.length];

const generatedEmployees: Employee[] = Array.from({ length: 1500 }, (_, i) => {
  const year = 2014 + (i % 11);
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 28) + 1).padStart(2, "0");
  return {
    name: `${at(FIRST, i, 1)} ${at(LAST, i, 2)} ${i + 1}`,
    role: at(ROLES, i, 3),
    team: at(TEAMS, i, 4),
    location: at(LOCATIONS, i, 5),
    startDate: `${year}-${month}-${day}`,
  };
});

export const employees: Employee[] = [...seedEmployees, ...generatedEmployees];

export const employeeColumns: ColumnDef<Employee>[] = [
  { id: "name", header: "Name", accessorKey: "name", size: 220 },
  { id: "role", header: "Role", accessorKey: "role", size: 200 },
  { id: "team", header: "Team", accessorKey: "team" },
  { id: "location", header: "Location", accessorKey: "location" },
  { id: "startDate", header: "Start Date", accessorKey: "startDate" },
];
