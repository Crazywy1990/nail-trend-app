export type Season = "base" | "summer" | "autumn" | "halloween" | "christmas";
export const SEASONS: Season[] = ["base", "summer", "autumn", "halloween", "christmas"];

/**
 * Holiday themes run short and start ahead of the date (people book 2-4 weeks out);
 * otherwise the season theme applies, and the base theme fills the rest of the year.
 */
export function seasonFor(d: Date): Season {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 10 && day >= 10) return "halloween";
  if ((m === 11 && day >= 25) || (m === 12 && day <= 26)) return "christmas";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "base";
}

export function isSeason(v: string | null | undefined): v is Season {
  return !!v && (SEASONS as string[]).includes(v);
}

type Chip = { label: string; group: "occasion" | "finish" | "length"; value: string };

const FINISH_CHIPS: Chip[] = [
  { label: "Chrome", group: "finish", value: "chrome" },
  { label: "Cat-eye", group: "finish", value: "cat-eye" },
  { label: "French", group: "finish", value: "french" },
  { label: "Matte", group: "finish", value: "matte" },
];

export const COPY: Record<Season, { greet: string; head: string; placeholder: string; chips: Chip[] }> = {
  base: {
    greet: "Good evening", head: "What's the occasion?",
    placeholder: "Work dinner next week, medium, not too loud",
    chips: [
      { label: "Work", group: "occasion", value: "work" },
      { label: "Wedding", group: "occasion", value: "wedding" },
      { label: "Vacation", group: "occasion", value: "vacation" },
      ...FINISH_CHIPS,
      { label: "Short", group: "length", value: "short" },
    ],
  },
  summer: {
    greet: "Morning", head: "Where are your nails going?",
    placeholder: "Beach weekend, medium length, bright",
    chips: [
      { label: "Vacation", group: "occasion", value: "vacation" },
      { label: "Work", group: "occasion", value: "work" },
      { label: "Wedding", group: "occasion", value: "wedding" },
      ...FINISH_CHIPS,
      { label: "Medium", group: "length", value: "medium" },
    ],
  },
  autumn: {
    greet: "Good evening", head: "What's the occasion?",
    placeholder: "Thanksgiving dinner, short, not too flashy",
    chips: [
      { label: "Work", group: "occasion", value: "work" },
      { label: "Date night", group: "occasion", value: "date night" },
      { label: "Wedding", group: "occasion", value: "wedding" },
      ...FINISH_CHIPS,
      { label: "Short", group: "length", value: "short" },
    ],
  },
  halloween: {
    greet: "Hey", head: "Spooky, but wearable?",
    placeholder: "Halloween party, short, a little dark",
    chips: [
      { label: "Party", group: "occasion", value: "party" },
      { label: "Work", group: "occasion", value: "work" },
      { label: "Date night", group: "occasion", value: "date night" },
      ...FINISH_CHIPS,
      { label: "Short", group: "length", value: "short" },
    ],
  },
  christmas: {
    greet: "Hi", head: "Ready for the holidays?",
    placeholder: "Office holiday party, medium, festive",
    chips: [
      { label: "Holiday party", group: "occasion", value: "holiday party" },
      { label: "Work", group: "occasion", value: "work" },
      { label: "Date night", group: "occasion", value: "date night" },
      ...FINISH_CHIPS,
      { label: "Medium", group: "length", value: "medium" },
    ],
  },
};
