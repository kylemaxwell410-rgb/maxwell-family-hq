// Centralized US-locale formatters so the kiosk display is consistent regardless of the Pi's system locale.
const TIME_OPTS = { hour: 'numeric', minute: '2-digit', hour12: true };
const DATE_SHORT_OPTS = { month: 'short', day: 'numeric' };
const DATE_LONG_OPTS  = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };

export function fmtTime(date) {
  return new Date(date).toLocaleTimeString('en-US', TIME_OPTS);
}

export function fmtDateShort(date) {
  return new Date(date).toLocaleDateString('en-US', DATE_SHORT_OPTS);
}

export function fmtDateLong(date) {
  return new Date(date).toLocaleDateString('en-US', DATE_LONG_OPTS);
}

// Used in dense rows (e.g. transaction history)
export function fmtDateTime(date) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function fmtDayOfWeek(dateOrISO) {
  return new Date(dateOrISO).toLocaleDateString('en-US', { weekday: 'short' });
}
