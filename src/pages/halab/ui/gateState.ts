/** When the gate intro plays: once per browser session, never for reduced motion, always with ?gate=1. */
import { markIntroSeen, shouldPlayIntro } from "../../../lib/introOnce";

const KEY = "halab:gate";

export const shouldShowGate = () => shouldPlayIntro(KEY, "gate");
export const markGateSeen = () => markIntroSeen(KEY);
