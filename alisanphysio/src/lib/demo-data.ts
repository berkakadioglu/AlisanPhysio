import { MARKETING } from "@/lib/marketing-content";

/**
 * Named training days repeat through each calendar month; reviews are monthly.
 * The demo's complete, static fixture boundary. Demo components import this
 * file—not dashboard loaders, auth helpers, API clients or server actions.
 */
export const DEMO_DATA = {
  ...MARKETING.demo,
  brand: MARKETING.brand,
} as const;

export type DemoViewId = (typeof DEMO_DATA.views)[number]["id"];
export type DemoProgrammeMonth =
  (typeof DEMO_DATA.programme.months)[number];
export type DemoProgrammeDay = DemoProgrammeMonth["days"][number];
export type DemoExercise = DemoProgrammeDay["exercises"][number];
export type DemoActionId = "review" | "download" | "schedule";

