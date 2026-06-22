/**
 * Business case: a multinational retailer's sales analytics.
 *
 * Rows are expandable across 4 levels of hierarchy:
 *   Region  ▸  Country  ▸  City  ▸  Store
 *
 * Every row (at any level) carries the same set of aggregated metrics, so the
 * same column definitions render the whole tree. Parent rows hold the rolled-up
 * totals of their children.
 */
export interface SalesRow {
  /** "Region" | "Country" | "City" | "Store" — purely for display. */
  level: "Region" | "Country" | "City" | "Store";
  name: string;

  // ── Revenue (currency, USD) ──
  grossRevenue: number;
  netRevenue: number;

  // ── Volume (counts) ──
  unitsSold: number;
  returns: number;

  // ── Margin (percent, 0-100) ──
  grossMargin: number;
  operatingMargin: number;

  // ── Bottom line (currency, USD) ──
  netProfit: number;

  subRows?: SalesRow[];
}

const store = (
  name: string,
  grossRevenue: number,
  unitsSold: number,
  returns: number,
  grossMargin: number,
  operatingMargin: number
): SalesRow => {
  const netRevenue = Math.round(grossRevenue * 0.94);
  return {
    level: "Store",
    name,
    grossRevenue,
    netRevenue,
    unitsSold,
    returns,
    grossMargin,
    operatingMargin,
    netProfit: Math.round(netRevenue * (operatingMargin / 100)),
  };
};

/** Roll a parent row up from its children so totals stay consistent. */
const rollup = (
  level: SalesRow["level"],
  name: string,
  subRows: SalesRow[]
): SalesRow => {
  const sum = (pick: (r: SalesRow) => number) =>
    subRows.reduce((acc, r) => acc + pick(r), 0);

  const grossRevenue = sum((r) => r.grossRevenue);
  const netRevenue = sum((r) => r.netRevenue);
  const netProfit = sum((r) => r.netProfit);
  const unitsSold = sum((r) => r.unitsSold);
  const returns = sum((r) => r.returns);

  // Weight the margin averages by gross revenue.
  const wAvg = (pick: (r: SalesRow) => number) =>
    grossRevenue === 0
      ? 0
      : Math.round(
          (sum((r) => pick(r) * r.grossRevenue) / grossRevenue) * 10
        ) / 10;

  return {
    level,
    name,
    grossRevenue,
    netRevenue,
    unitsSold,
    returns,
    grossMargin: wAvg((r) => r.grossMargin),
    operatingMargin: wAvg((r) => r.operatingMargin),
    netProfit,
    subRows,
  };
};

const curatedSales: SalesRow[] = [
  rollup("Region", "North America", [
    rollup("Country", "United States", [
      rollup("City", "New York", [
        store("5th Avenue Flagship", 1_840_000, 48_200, 1_410, 42.5, 21.8),
        store("Brooklyn Outlet", 640_000, 21_900, 980, 36.0, 15.2),
      ]),
      rollup("City", "San Francisco", [
        store("Union Square", 1_210_000, 30_400, 720, 44.1, 23.6),
        store("Bay Street Mall", 530_000, 16_800, 540, 38.4, 17.0),
      ]),
    ]),
    rollup("Country", "Canada", [
      rollup("City", "Toronto", [
        store("Eaton Centre", 760_000, 22_100, 610, 40.2, 19.4),
        store("Yorkdale", 690_000, 19_700, 480, 41.6, 20.1),
      ]),
    ]),
  ]),
  rollup("Region", "Europe", [
    rollup("Country", "United Kingdom", [
      rollup("City", "London", [
        store("Oxford Street", 1_520_000, 39_800, 1_120, 43.0, 22.3),
        store("Canary Wharf", 880_000, 24_500, 700, 39.8, 18.7),
      ]),
    ]),
    rollup("Country", "Germany", [
      rollup("City", "Berlin", [
        store("Mitte Store", 720_000, 20_600, 530, 37.9, 16.5),
        store("KaDeWe Pop-up", 410_000, 11_200, 260, 45.5, 24.9),
      ]),
      rollup("City", "Munich", [
        store("Marienplatz", 660_000, 18_400, 410, 42.8, 21.0),
      ]),
    ]),
  ]),
  rollup("Region", "Asia Pacific", [
    rollup("Country", "Japan", [
      rollup("City", "Tokyo", [
        store("Ginza Six", 1_690_000, 41_300, 900, 46.2, 25.4),
        store("Shibuya Crossing", 1_130_000, 33_700, 1_050, 40.7, 19.9),
      ]),
    ]),
    rollup("Country", "Australia", [
      rollup("City", "Sydney", [
        store("Pitt Street Mall", 940_000, 26_100, 640, 41.1, 20.6),
        store("Bondi Junction", 560_000, 15_900, 470, 38.0, 16.8),
      ]),
    ]),
  ]),
];

// ── Synthetic regions so the nested table has enough rows to virtualize ──
// Generated deterministically (no Math.random) so the tree is stable across
// renders. Expand the regions to scroll through hundreds of rolled-up rows.
const REGION_NAMES = [
  "Latin America", "Middle East", "Northern Europe", "Southeast Asia",
  "Central Africa", "Oceania", "Caribbean", "South Asia", "East Asia",
  "Eastern Europe", "Iberia", "Nordics", "Benelux", "Balkans", "Levant",
];
const COUNTRY_NAMES = [
  "Brazil", "Mexico", "UAE", "Sweden", "Vietnam", "Kenya", "Chile",
  "India", "Korea", "Poland", "Portugal", "Norway", "Greece", "Egypt",
];
const CITY_NAMES = [
  "Metro", "Harbor", "Capital", "Lakeside", "Old Town", "Riverside",
  "Uptown", "Midtown", "Bayview", "Hillcrest",
];

const spread = <T,>(arr: T[], i: number, salt: number) =>
  arr[(i * 7 + salt * 13) % arr.length];

const generatedSales: SalesRow[] = Array.from({ length: 80 }, (_, r) =>
  rollup(
    "Region",
    `${spread(REGION_NAMES, r, 1)} ${r + 1}`,
    Array.from({ length: 2 }, (_, c) =>
      rollup(
        "Country",
        `${spread(COUNTRY_NAMES, r, c + 2)} ${r + 1}.${c + 1}`,
        Array.from({ length: 2 }, (_, ci) =>
          rollup(
            "City",
            `${spread(CITY_NAMES, r + ci, c + 3)} ${r + 1}.${c + 1}.${ci + 1}`,
            Array.from({ length: 3 }, (_, s) => {
              const seed = ((r + 1) * 31 + (c + 1) * 17 + (ci + 1) * 11 + s) % 100;
              return store(
                `Store ${r + 1}.${c + 1}.${ci + 1}.${s + 1}`,
                300_000 + seed * 18_500,
                8_000 + seed * 540,
                200 + seed * 16,
                34 + (seed % 14),
                14 + (seed % 12)
              );
            })
          )
        )
      )
    )
  )
);

export const salesData: SalesRow[] = [...curatedSales, ...generatedSales];
