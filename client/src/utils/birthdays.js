import { startOfDay, daysBetween } from './dateMath.js';

// Accepts 'YYYY-MM-DD' or 'MM-DD'.
function parseBirthday(s) {
  if (!s) return null;
  const parts = s.split('-').map(n => parseInt(n, 10));
  if (parts.length === 3) return { month: parts[1] - 1, day: parts[2], birthYear: parts[0] };
  if (parts.length === 2) return { month: parts[0] - 1, day: parts[1], birthYear: null };
  return null;
}

export function nextBirthdayDate(birthdayStr, from = new Date()) {
  const p = parseBirthday(birthdayStr);
  if (!p) return null;
  const today = startOfDay(from);
  let candidate = new Date(today.getFullYear(), p.month, p.day);
  if (candidate < today) candidate = new Date(today.getFullYear() + 1, p.month, p.day);
  return candidate;
}

export function ageOnNextBirthday(birthdayStr, from = new Date()) {
  const p = parseBirthday(birthdayStr);
  if (!p || p.birthYear == null) return null;
  const next = nextBirthdayDate(birthdayStr, from);
  return next.getFullYear() - p.birthYear;
}

// People with birthdays within `windowDays` (default 30), sorted by soonest.
export function upcomingBirthdays(people, from = new Date(), windowDays = 30) {
  const today = startOfDay(from);
  return people
    .map(p => {
      const next = nextBirthdayDate(p.birthday, today);
      if (!next) return null;
      const days = daysBetween(today, next);
      return { person: p, date: next, daysUntil: days, age: ageOnNextBirthday(p.birthday, today) };
    })
    .filter(b => b && b.daysUntil <= windowDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// Always returns the very next birthday on the calendar (any distance), or null.
export function nextBirthdayAny(people, from = new Date()) {
  const list = people
    .map(p => {
      const next = nextBirthdayDate(p.birthday, from);
      if (!next) return null;
      return { person: p, date: next, daysUntil: daysBetween(from, next), age: ageOnNextBirthday(p.birthday, from) };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  return list[0] || null;
}
