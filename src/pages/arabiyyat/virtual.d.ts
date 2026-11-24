declare module "virtual:arabiyyat-days" {
  import type { Day, Source } from "./core/types";
  import type { DayModule } from "../../lib/dayStore";
  /** Every book the full schedule draws from (the shipped days alone name only a few). */
  export const sources: Source[];
  export const recent: DayModule<Day>["recent"];
  export const count: number, last: number, blockDays: number;
  export const blocks: DayModule<Day>["blocks"];
}
