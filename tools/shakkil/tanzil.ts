/**
 * The Tanzil Quran text, for checking that Quran puzzles are verbatim.
 *
 * Reads .cache/tanzil/quran-simple.txt: the Tanzil "simple" text (sura|aya|text) from
 * https://tanzil.net/download (CC BY 3.0, verbatim only, credit + link to tanzil.net). It is not
 * committed; without it the checks are skipped.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const TANZIL_FILE = resolve(import.meta.dirname, "../../.cache/tanzil/quran-simple.txt");

/** Sura names as puzzle refs write them («سورة آل عمران، الآية ١٣٩»), index = sura number − 1. */
export const SURAS = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
  "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
  "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
  "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
  "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
  "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
  "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
  "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
  "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
  "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
  "المسد", "الإخلاص", "الفلق", "الناس",
];

let cache: Map<string, string> | null | undefined;

/** "sura:aya" → verse text (NFC), or null when the Tanzil file isn't downloaded. */
export function loadTanzil(path = TANZIL_FILE): Map<string, string> | null {
  if (path === TANZIL_FILE && cache !== undefined) return cache;
  if (!existsSync(path)) return (cache = null);
  const verses = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
    // NFC: canonically equivalent text (e.g. shadda+fatha vs fatha+shadda) compares equal.
    if (m) verses.set(`${m[1]}:${m[2]}`, m[3].normalize("NFC"));
  }
  if (path === TANZIL_FILE) cache = verses;
  return verses;
}

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));

/** «سورة الشرح، الآية ٦» → "94:6"; null if the ref isn't in that form. */
export function quranKey(ref: string | undefined): string | null {
  const m = /^سورة (.+)، الآية ([٠-٩0-9]+)$/.exec((ref ?? "").trim());
  if (!m) return null;
  const sura = SURAS.indexOf(m[1].trim()) + 1;
  return sura ? `${sura}:${toLatin(m[2])}` : null;
}

/**
 * Problems with a Quran puzzle's text against Tanzil: the ref must name one ayah, and the text must
 * be a verbatim part of it. Returns [] when the Tanzil file isn't downloaded.
 */
export function quranProblems(text: string, ref: string | undefined): string[] {
  const verses = loadTanzil();
  if (!verses) return [];
  const key = quranKey(ref);
  if (!key) return [`المرجع يجب أن يكون «سورة …، الآية …» / ref must look like «سورة الشرح، الآية ٦»`];
  const verse = verses.get(key);
  if (!verse) return [`لا توجد آية ${key} / no such ayah ${key}`];
  if (!verse.includes(text.normalize("NFC").trim())) {
    return [`ليس نصًا حرفيًا من الآية ${key} / not verbatim Tanzil text of ${key}: ${verse}`];
  }
  return [];
}
