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
  phone: string;
  title: string;
  level: string;
  manager: string;
  team: string;
  office: string;
  timezone: string;
  status: string;
  employmentType: string;
  tenureYears: number;
  bonus: number;
  vacationDays: number;
  projects: number;
  performance: string;
  lastReview: string;
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

const TITLES = [
  "Engineer", "Senior Engineer", "Staff Engineer", "Designer", "Manager",
  "Analyst", "Architect", "Lead", "Specialist", "Director",
];
const LEVELS = ["L2", "L3", "L4", "L5", "L6", "L7"];
const TEAMS = [
  "Core", "Edge", "Billing", "Identity", "Search", "Notifications",
  "Onboarding", "Reporting", "Realtime", "Compliance",
];
const TIMEZONES = [
  "UTC-8", "UTC-5", "UTC+0", "UTC+1", "UTC+2", "UTC+5:30", "UTC+9", "UTC+10",
];
const STATUSES = ["Active", "On Leave", "Remote", "Onsite"];
const EMPLOYMENT = ["Full-time", "Part-time", "Contract", "Intern"];
const PERFORMANCE = ["Exceeds", "Meets", "Outstanding", "Developing"];

/** Cheap deterministic spread so adjacent rows don't all look identical. */
const pick = <T,>(arr: T[], i: number, salt: number) =>
  arr[(i * 7 + salt * 13) % arr.length];

export const people: Person[] = Array.from({ length: 10_000 }, (_, i) => {
  const first = pick(FIRST, i, 1);
  const last = pick(LAST, i, 2);
  const year = 2015 + (i % 10);
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 28) + 1).padStart(2, "0");
  const reviewYear = 2023 + (i % 3);
  return {
    id: i + 1,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    department: pick(DEPARTMENTS, i, 3),
    city: pick(CITIES, i, 4),
    salary: 70_000 + ((i * 137) % 90_000),
    startDate: `${year}-${month}-${day}`,
    phone: `+1 (${200 + (i % 700)}) ${100 + (i % 900)}-${1000 + (i % 9000)}`,
    title: pick(TITLES, i, 5),
    level: pick(LEVELS, i, 6),
    manager: `${pick(FIRST, i, 7)} ${pick(LAST, i, 8)}`,
    team: pick(TEAMS, i, 9),
    office: pick(CITIES, i, 10),
    timezone: pick(TIMEZONES, i, 11),
    status: pick(STATUSES, i, 12),
    employmentType: pick(EMPLOYMENT, i, 13),
    tenureYears: 1 + (i % 15),
    bonus: 2_000 + ((i * 91) % 40_000),
    vacationDays: 10 + (i % 21),
    projects: 1 + (i % 12),
    performance: pick(PERFORMANCE, i, 14),
    lastReview: `${reviewYear}-${month}-${day}`,
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
  { id: "phone", header: "Phone", accessorKey: "phone", size: 170 },
  { id: "title", header: "Title", accessorKey: "title", size: 160 },
  { id: "level", header: "Level", accessorKey: "level", size: 90 },
  { id: "department", header: "Department", accessorKey: "department", size: 150 },
  { id: "team", header: "Team", accessorKey: "team", size: 140 },
  { id: "manager", header: "Manager", accessorKey: "manager", size: 170 },
  { id: "city", header: "City", accessorKey: "city", size: 150 },
  { id: "office", header: "Office", accessorKey: "office", size: 150 },
  { id: "timezone", header: "Timezone", accessorKey: "timezone", size: 110 },
  { id: "status", header: "Status", accessorKey: "status", size: 120 },
  {
    id: "employmentType",
    header: "Employment",
    accessorKey: "employmentType",
    size: 130,
  },
  {
    id: "salary",
    header: "Salary",
    accessorKey: "salary",
    size: 130,
    cell: (info) => usd(info.getValue<number>()),
  },
  {
    id: "bonus",
    header: "Bonus",
    accessorKey: "bonus",
    size: 120,
    cell: (info) => usd(info.getValue<number>()),
  },
  { id: "tenureYears", header: "Tenure (yrs)", accessorKey: "tenureYears", size: 110 },
  { id: "vacationDays", header: "Vacation Days", accessorKey: "vacationDays", size: 120 },
  { id: "projects", header: "Projects", accessorKey: "projects", size: 100 },
  { id: "performance", header: "Performance", accessorKey: "performance", size: 130 },
  { id: "startDate", header: "Start Date", accessorKey: "startDate", size: 130 },
  { id: "lastReview", header: "Last Review", accessorKey: "lastReview", size: 130 },
];
