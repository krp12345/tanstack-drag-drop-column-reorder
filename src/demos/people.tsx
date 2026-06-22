import type { ColumnDef } from "@tanstack/react-table";

/**
 * Demo 4 — a large flat dataset built purely to exercise row virtualization.
 * 10,000 rows are generated deterministically (no Math.random, so the data is
 * stable across renders) and handed to the same <DataTable>. Only the rows
 * inside the scroll viewport are ever mounted; scroll to watch them recycle.
 */
export interface Person {
  id: number;
  name: string;
  email: string;
  department: string;
  city: string;
  salary: number;
  startDate: string;
}

const FIRST = [
  "Ava", "Liam", "Noah", "Sofia", "Yuki", "Maya", "Omar", "Elena",
  "Mateo", "Priya", "Hugo", "Nina", "Diego", "Lena", "Arjun", "Clara",
];
const LAST = [
  "Thompson", "Chen", "Müller", "Rossi", "Tanaka", "Patel", "Haddad",
  "Novak", "Garcia", "Sharma", "Dubois", "Kowalski", "Silva", "Andersen",
];
const DEPARTMENTS = [
  "Platform", "Growth", "Payments", "Insights", "Web", "Infrastructure",
  "Design", "Support", "Security", "Mobile",
];
const CITIES = [
  "Austin, US", "Toronto, CA", "Berlin, DE", "Milan, IT", "Tokyo, JP",
  "London, UK", "Madrid, ES", "Sydney, AU", "Pune, IN", "Oslo, NO",
];

/** Cheap deterministic spread so adjacent rows don't all look identical. */
const pick = <T,>(arr: T[], i: number, salt: number) =>
  arr[(i * 7 + salt * 13) % arr.length];

export const people: Person[] = Array.from({ length: 10_000 }, (_, i) => {
  const first = pick(FIRST, i, 1);
  const last = pick(LAST, i, 2);
  const year = 2015 + (i % 10);
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 28) + 1).padStart(2, "0");
  return {
    id: i + 1,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    department: pick(DEPARTMENTS, i, 3),
    city: pick(CITIES, i, 4),
    salary: 70_000 + ((i * 137) % 90_000),
    startDate: `${year}-${month}-${day}`,
  };
});

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const peopleColumns: ColumnDef<Person>[] = [
  { id: "id", header: "#", accessorKey: "id", size: 70 },
  { id: "name", header: "Name", accessorKey: "name", size: 180 },
  { id: "email", header: "Email", accessorKey: "email", size: 260 },
  { id: "department", header: "Department", accessorKey: "department", size: 150 },
  { id: "city", header: "City", accessorKey: "city", size: 150 },
  {
    id: "salary",
    header: "Salary",
    accessorKey: "salary",
    size: 130,
    cell: (info) => usd(info.getValue<number>()),
  },
  { id: "startDate", header: "Start Date", accessorKey: "startDate", size: 130 },
];
