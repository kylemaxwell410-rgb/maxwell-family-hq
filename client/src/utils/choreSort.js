// Sort chores by time-of-day so a kid's column reads top-to-bottom in
// chronological order: 8am, 9am, 12pm, 7pm, 9pm. Chores with no time
// fall to the bottom (after all timed chores).
//
// The match key is the chore title with the leading emoji + space
// stripped — e.g. '🐾 8am — Feed animals' → '8am — Feed animals' → 8am.

export function timeKey(title) {
  if (!title) return 9999;
  const s = title.replace(/^[^A-Za-z0-9]+/, '').trim();

  // "9am", "12pm", etc.
  const m = s.match(/^(\d{1,2})(am|pm)\b/i);
  if (m) {
    let hour = parseInt(m[1], 10);
    const ampm = m[2].toLowerCase();
    if (ampm === 'am' && hour === 12) hour = 0;
    if (ampm === 'pm' && hour !== 12) hour += 12;
    return hour * 60;
  }

  // Common loose-time words.
  if (/^morning/i.test(s)) return 8 * 60;     // ~8am
  if (/^noon/i.test(s))    return 12 * 60;
  if (/^afternoon/i.test(s)) return 14 * 60;  // ~2pm
  if (/^evening/i.test(s)) return 18 * 60;    // ~6pm
  if (/^night/i.test(s))   return 21 * 60;    // ~9pm

  return 9999; // untimed — bottom
}

export function sortByTime(chores) {
  return [...chores].sort((a, b) => timeKey(a.title) - timeKey(b.title));
}
