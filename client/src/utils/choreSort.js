// Sort chores into three blocks per kid column:
//   1. AM-timed chores (8am, 9am, 11am…)  — sorted chronologically within
//   2. Untimed chores (no time prefix)     — middle
//   3. PM-timed chores (12pm, 7pm, 9pm…)   — sorted chronologically within
//
// The match key is the chore title with the leading emoji + space
// stripped — e.g. '🐾 8am — Feed animals' → '8am — Feed animals' → 8am.

const UNTIMED_BUCKET = 1000;  // anything between AM (0–660) and PM (>=2000)
const PM_OFFSET      = 2000;

export function timeKey(title) {
  if (!title) return UNTIMED_BUCKET;
  const s = title.replace(/^[^A-Za-z0-9]+/, '').trim();

  // Numeric times like "9am", "12pm".
  const m = s.match(/^(\d{1,2})(am|pm)\b/i);
  if (m) {
    const hour = parseInt(m[1], 10);
    const ampm = m[2].toLowerCase();
    if (ampm === 'am') {
      // 12am → midnight (0). Otherwise hour stays in 0–11 range.
      return (hour === 12 ? 0 : hour) * 60;
    }
    // pm: 12pm → noon (12). Otherwise add 12.
    return PM_OFFSET + (hour === 12 ? 12 : hour + 12) * 60;
  }

  // Loose-time words. Morning is AM; afternoon/evening/night/noon are PM.
  if (/^morning/i.test(s))   return 8 * 60;
  if (/^noon/i.test(s))      return PM_OFFSET + 12 * 60;
  if (/^afternoon/i.test(s)) return PM_OFFSET + 14 * 60;
  if (/^evening/i.test(s))   return PM_OFFSET + 18 * 60;
  if (/^night/i.test(s))     return PM_OFFSET + 21 * 60;

  return UNTIMED_BUCKET; // no time → middle bucket
}

export function sortByTime(chores) {
  return [...chores].sort((a, b) => timeKey(a.title) - timeKey(b.title));
}
