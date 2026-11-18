/** Two-hour booking windows across typical salon hours (9 am – 9 pm), plus "any time". */
export const TIME_WINDOWS = [
  { value: "any", label: "Any time" },
  { value: "09-11", label: "9 – 11 am" },
  { value: "11-13", label: "11 am – 1 pm" },
  { value: "13-15", label: "1 – 3 pm" },
  { value: "15-17", label: "3 – 5 pm" },
  { value: "17-19", label: "5 – 7 pm" },
  { value: "19-21", label: "7 – 9 pm" },
] as const;

const LEGACY: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
export const windowLabel = (v: string | null | undefined) =>
  TIME_WINDOWS.find((w) => w.value === v)?.label ?? (v ? LEGACY[v] ?? v : "Any time");
