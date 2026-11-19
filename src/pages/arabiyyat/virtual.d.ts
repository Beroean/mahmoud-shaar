declare module "virtual:arabiyyat-days" {
  import type { Day, Source } from "./core/types";
  /** Every book the full schedule draws from (the shipped days alone name only a few). */
  export const sources: Source[];
  const days: Day[];
  export default days;
}
