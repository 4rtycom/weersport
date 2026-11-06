/** Calendar-month period keys in Europe/Amsterdam. */
export function amsterdamParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
  };
}

export function calendarPeriodKey(date = new Date()) {
  const { year, month } = amsterdamParts(date);
  return `${year}-${month}`;
}

export function hourBucketKey(date = new Date()) {
  const { year, month, day, hour } = amsterdamParts(date);
  return `${year}-${month}-${day}T${hour}`;
}

export function nextCalendarResetIso(date = new Date()) {
  const { year, month } = amsterdamParts(date);
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  // Interpret first of next month 00:00 Amsterdam as reset boundary label.
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+01:00`;
}

export function addDaysIso(days: number, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
