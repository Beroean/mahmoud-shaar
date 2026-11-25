/**
 * The country profile's measures (CountryProfile.tsx): which World Bank indicators it shows, and
 * the fixed rule by which each is read as better or worse. This file is the page's whole opinion;
 * every part of it is printed on the page beside the measure it applies to. The figures themselves
 * are the World Bank's, unchanged (tools/wdi/country.ts copies them out of the explorer's data).
 */

export type DatasetKey = "wdi" | "wgi";

/**
 * How a change is read: "higher"/"lower" = that direction counts as better; "context" = shown
 * without a reading, because which direction is better is open to argument.
 */
export type Reading = "higher" | "lower" | "context";

/**
 * A change smaller than this counts as "little change": `points` in the measure's own unit
 * (percentage points, years, score points), or `percent` of the first figure.
 */
export type FlatRule = { points: number } | { percent: number };

export interface Measure {
  dataset: DatasetKey;
  /** The World Bank's series code. */
  id: string;
  /** A short plain name; the World Bank's full name is shown in the details. */
  label: string;
  /** The unit in words, after the label. */
  unit: string;
  group: GroupKey;
  reading: Reading;
  /** Why it is read this way (or, for context, why it isn't read). Shown in the details. */
  basis: string;
  flat: FlatRule;
  /** Number display. */
  prefix?: string;
  suffix?: string;
  digits: number;
  /** Large counts as 23.2M. */
  compact?: boolean;
}

export const GROUPS = [
  { key: "health", name: "Health" },
  { key: "living", name: "Living standards" },
  { key: "education", name: "Education" },
  { key: "services", name: "Basic services" },
  { key: "governance", name: "Governance" },
  { key: "society", name: "Safety, representation and air" },
  { key: "context", name: "For context" },
] as const;
export type GroupKey = (typeof GROUPS)[number]["key"];

const POINT: FlatRule = { points: 1 };
const FIVE_PERCENT: FlatRule = { percent: 5 };

const share = { suffix: "%", digits: 1, flat: POINT } as const;

/** The six Worldwide Governance Indicators, as the World Bank's absolute 0–100 score. */
const wgi = (code: string, label: string, sdg: string): Measure => ({
  dataset: "wgi",
  id: `GOV_WGI_${code}.SC`,
  label,
  unit: "score, 0 to 100",
  group: "governance",
  reading: "higher",
  basis: `The World Bank defines this score so that larger values correspond to better governance. Related UN Sustainable Development Goal target: ${sdg}. It is built from surveys of perceptions, and the World Bank publishes a margin of error with it, so only moves of 3 points or more are counted here.`,
  flat: { points: 3 },
  digits: 1,
});

export const MEASURES: Measure[] = [
  // ── Health ──
  {
    dataset: "wdi",
    id: "SP.DYN.LE00.IN",
    label: "Life expectancy at birth",
    unit: "years",
    group: "health",
    reading: "higher",
    basis: "Life expectancy is not itself a UN Sustainable Development Goal indicator, but it summarises the mortality targets of Goal 3.",
    flat: POINT,
    suffix: " yrs",
    digits: 1,
  },
  {
    dataset: "wdi",
    id: "SH.DYN.MORT",
    label: "Deaths of children under five",
    unit: "per 1,000 live births",
    group: "health",
    reading: "lower",
    basis: "UN Sustainable Development Goal target 3.2 is to end preventable deaths of children under five.",
    flat: FIVE_PERCENT,
    digits: 1,
  },
  {
    dataset: "wdi",
    id: "SH.STA.MMRT",
    label: "Deaths of mothers in childbirth",
    unit: "per 100,000 live births",
    group: "health",
    reading: "lower",
    basis: "UN Sustainable Development Goal target 3.1 is to reduce the maternal mortality ratio.",
    flat: FIVE_PERCENT,
    digits: 0,
  },
  {
    dataset: "wdi",
    id: "SN.ITK.DEFC.ZS",
    label: "Undernourishment",
    unit: "% of population",
    group: "health",
    reading: "lower",
    basis: "UN Sustainable Development Goal target 2.1 is to end hunger.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "SH.IMM.MEAS",
    label: "Measles immunisation",
    unit: "% of children aged 12–23 months",
    group: "health",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 3.b tracks vaccine coverage; higher coverage is the aim.",
    ...share,
    digits: 0,
  },

  // ── Living standards ──
  {
    dataset: "wdi",
    id: "NY.GDP.PCAP.KD",
    label: "GDP per person",
    unit: "constant 2015 US$",
    group: "living",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 8.1 is to sustain economic growth per person. GDP per person is an average: it says nothing about how income is shared.",
    flat: FIVE_PERCENT,
    prefix: "$",
    digits: 0,
  },
  {
    dataset: "wdi",
    id: "SI.POV.DDAY",
    label: "Extreme poverty",
    unit: "% of population living on less than $3.00 a day (2021 PPP)",
    group: "living",
    reading: "lower",
    basis: "UN Sustainable Development Goal target 1.1 is to end extreme poverty. Figures come from household surveys, which many countries run only every few years.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "SL.UEM.TOTL.ZS",
    label: "Unemployment",
    unit: "% of labour force (ILO modelled estimate)",
    group: "living",
    reading: "lower",
    basis: "UN Sustainable Development Goal target 8.5 is full and productive employment. A low rate can hide informal or insecure work.",
    ...share,
  },

  // ── Education ──
  {
    dataset: "wdi",
    id: "SE.PRM.CMPT.ZS",
    label: "Primary school completion",
    unit: "% of relevant age group",
    group: "education",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 4.1 is for all children to complete primary and secondary education. The rate can pass 100% when older or younger children finish the last grade.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "SE.SEC.CMPT.LO.ZS",
    label: "Lower secondary school completion",
    unit: "% of relevant age group",
    group: "education",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 4.1 is for all children to complete primary and secondary education.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "SE.ADT.LITR.ZS",
    label: "Adult literacy",
    unit: "% of people aged 15 and above",
    group: "education",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 4.6 is for adults to achieve literacy.",
    ...share,
  },

  // ── Basic services ──
  {
    dataset: "wdi",
    id: "EG.ELC.ACCS.ZS",
    label: "Access to electricity",
    unit: "% of population",
    group: "services",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 7.1 is universal access to electricity.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "SH.H2O.BASW.ZS",
    label: "Basic drinking water",
    unit: "% of population using at least basic services",
    group: "services",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 6.1 is universal access to safe drinking water. The goal's own indicator is the stricter \"safely managed\" level, which far fewer countries report; this page uses \"at least basic\" so that more countries have a figure.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "SH.STA.BASS.ZS",
    label: "Basic sanitation",
    unit: "% of population using at least basic services",
    group: "services",
    reading: "higher",
    basis: "UN Sustainable Development Goal target 6.2 is access to adequate sanitation for all. As with water, the stricter \"safely managed\" level is reported by far fewer countries.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "IT.NET.USER.ZS",
    label: "People using the internet",
    unit: "% of population",
    group: "services",
    reading: "higher",
    basis: "UN Sustainable Development Goal indicator 17.8.1 tracks the share of people using the internet; wider use is the aim.",
    ...share,
  },

  // ── Governance ──
  wgi("CC", "Control of corruption", "16.5, reduce corruption and bribery"),
  wgi("GE", "Government effectiveness", "16.6, effective and accountable institutions"),
  wgi("PV", "Political stability and absence of violence", "16.1, reduce all forms of violence"),
  wgi("RQ", "Regulatory quality", "16.6, effective and accountable institutions"),
  wgi("RL", "Rule of law", "16.3, promote the rule of law"),
  wgi("VA", "Voice and accountability", "16.7, responsive and representative decision-making"),

  // ── Safety, representation and air ──
  {
    dataset: "wdi",
    id: "VC.IHR.PSRC.P5",
    label: "Homicides",
    unit: "per 100,000 people",
    group: "society",
    reading: "lower",
    basis: "UN Sustainable Development Goal target 16.1 is to reduce violence and related deaths. Deaths in armed conflict are not counted as homicides.",
    flat: FIVE_PERCENT,
    digits: 1,
  },
  {
    dataset: "wdi",
    id: "SG.GEN.PARL.ZS",
    label: "Women in parliament",
    unit: "% of seats in the single or lower chamber",
    group: "society",
    reading: "higher",
    basis: "UN Sustainable Development Goal indicator 5.5.1 tracks seats held by women in national parliaments; the aim is equal participation.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "EN.ATM.PM25.MC.M3",
    label: "Air pollution (PM2.5)",
    unit: "micrograms per cubic metre, average exposure",
    group: "society",
    reading: "lower",
    basis: "UN Sustainable Development Goal indicator 11.6.2 tracks fine particulate matter in the air; the aim is to lower it.",
    flat: FIVE_PERCENT,
    suffix: " µg/m³",
    digits: 1,
  },

  // ── Context: shown without a reading ──
  {
    dataset: "wdi",
    id: "SP.POP.TOTL",
    label: "Population",
    unit: "people",
    group: "context",
    reading: "context",
    basis: "A larger or smaller population is neither better nor worse in itself.",
    flat: FIVE_PERCENT,
    digits: 1,
    compact: true,
  },
  {
    dataset: "wdi",
    id: "SP.DYN.TFRT.IN",
    label: "Fertility rate",
    unit: "births per woman",
    group: "context",
    reading: "context",
    basis: "Falling fertility usually goes with better health and schooling for women, but very low fertility brings ageing and a shrinking workforce. There is no agreed better direction.",
    flat: FIVE_PERCENT,
    digits: 2,
  },
  {
    dataset: "wdi",
    id: "SP.URB.TOTL.IN.ZS",
    label: "People living in cities",
    unit: "% of population",
    group: "context",
    reading: "context",
    basis: "Urbanisation tends to accompany rising incomes, but it is a change in how people live, not a gain or a loss in itself.",
    ...share,
  },
  {
    dataset: "wdi",
    id: "EN.GHG.CO2.PC.CE.AR5",
    label: "CO₂ emissions per person",
    unit: "tonnes of CO₂ equivalent, excluding land use",
    group: "context",
    reading: "context",
    basis: "Lower emissions are better for the climate. But in poorer countries, rising emissions usually come with more energy and higher incomes, so one direction cannot be called better for every country.",
    flat: FIVE_PERCENT,
    suffix: " t",
    digits: 2,
  },
  {
    dataset: "wdi",
    id: "FP.CPI.TOTL.ZG",
    label: "Inflation",
    unit: "consumer prices, annual %",
    group: "context",
    reading: "context",
    basis: "Both very high inflation and falling prices do harm; the healthy range is a low positive rate, so neither direction is better in general. The figure also jumps from year to year, which makes first-to-latest comparisons unreliable.",
    ...share,
  },
];

/** The World Bank's own page for a series. The WGI has one site for all six dimensions. */
export function worldBankUrl(m: Measure): string {
  return m.dataset === "wgi"
    ? "https://www.worldbank.org/en/publication/worldwide-governance-indicators"
    : `https://data.worldbank.org/indicator/${encodeURIComponent(m.id)}`;
}

export const DATASET_NAMES: Record<DatasetKey, { name: string; url: string; license: string }> = {
  wdi: {
    name: "World Development Indicators",
    url: "https://datatopics.worldbank.org/world-development-indicators/",
    license: "CC BY 4.0",
  },
  wgi: {
    name: "Worldwide Governance Indicators",
    url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
    license: "CC BY 4.0",
  },
};

export function formatValue(m: Measure, v: number): string {
  const n = m.compact
    ? v.toLocaleString("en", { notation: "compact", maximumFractionDigits: m.digits })
    : v.toLocaleString("en", { maximumFractionDigits: m.digits, minimumFractionDigits: 0 });
  return `${m.prefix ?? ""}${n}${m.suffix ?? ""}`;
}
