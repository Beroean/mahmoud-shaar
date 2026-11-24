declare module "virtual:halab-days" {
  import type { Day } from "./core/types";
  import type { DayModule } from "../../lib/dayStore";
  export const recent: DayModule<Day>["recent"];
  export const count: number, last: number, blockDays: number;
  export const blocks: DayModule<Day>["blocks"];
}
