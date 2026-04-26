import { startOfDay } from './dateMath.js';

function nthWeekday(year, monthIdx, weekday, n) {
  if (n > 0) {
    const first = new Date(year, monthIdx, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, monthIdx, 1 + offset + (n - 1) * 7);
  }
  // n < 0: last weekday of the month
  const last = new Date(year, monthIdx + 1, 0);
  const lastOffset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, monthIdx, last.getDate() - lastOffset);
}

// Anonymous Gregorian algorithm for Easter Sunday.
function easterFor(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function holidaysForYear(year) {
  return [
    { name: "New Year's Day",   date: new Date(year, 0, 1),         emoji: '🎉' },
    { name: "Valentine's Day",  date: new Date(year, 1, 14),        emoji: '💝' },
    { name: 'Easter',           date: easterFor(year),              emoji: '🐰' },
    { name: "Mother's Day",     date: nthWeekday(year, 4, 0, 2),    emoji: '💐' },
    { name: 'Memorial Day',     date: nthWeekday(year, 4, 1, -1),   emoji: '🇺🇸' },
    { name: "Father's Day",     date: nthWeekday(year, 5, 0, 3),    emoji: '👔' },
    { name: 'Independence Day', date: new Date(year, 6, 4),         emoji: '🎆' },
    { name: 'Halloween',        date: new Date(year, 9, 31),        emoji: '🎃' },
    { name: 'Thanksgiving',     date: nthWeekday(year, 10, 4, 4),   emoji: '🦃' },
    { name: 'Christmas',        date: new Date(year, 11, 25),       emoji: '🎄' },
  ].sort((a, b) => a.date - b.date);
}

export function nextHoliday(from = new Date()) {
  const today = startOfDay(from);
  const candidates = [
    ...holidaysForYear(today.getFullYear()),
    ...holidaysForYear(today.getFullYear() + 1),
  ];
  return candidates.find(h => h.date >= today) || null;
}
