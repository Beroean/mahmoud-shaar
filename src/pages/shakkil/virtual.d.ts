declare module "virtual:shakkil-days" {
  import type { PuzzleSource } from "./core/puzzle";
  import type { DayModule } from "../../lib/dayStore";
  export const recent: DayModule<PuzzleSource>["recent"];
  export const count: number, last: number, blockDays: number;
  export const blocks: DayModule<PuzzleSource>["blocks"];
}
