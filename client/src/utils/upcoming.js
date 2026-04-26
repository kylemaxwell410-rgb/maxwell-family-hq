import { startOfDay, daysBetween } from './dateMath.js';
import { holidaysForYear } from './holidays.js';
import { nextBirthdayDate, ageOnNextBirthday } from './birthdays.js';

// Returns the next `count` items mixing birthdays + holidays, sorted by date.
export function upcomingMixed(people, count = 5, from = new Date()) {
  const today = startOfDay(from);
  const items = [];

  for (const p of people) {
    if (!p.birthday) continue;
    const date = nextBirthdayDate(p.birthday, today);
    if (!date) continue;
    items.push({
      type: 'birthday',
      key: `bd-${p.id}`,
      label: p.name,
      emoji: '🎂',
      date,
      color: p.color,
      person: p,
      age: ageOnNextBirthday(p.birthday, today),
      daysUntil: daysBetween(today, date),
    });
  }

  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    for (const h of holidaysForYear(year)) {
      if (h.date < today) continue;
      items.push({
        type: 'holiday',
        key: `hol-${year}-${h.name}`,
        label: h.name,
        emoji: h.emoji,
        date: h.date,
        color: '#94a3b8',
        daysUntil: daysBetween(today, h.date),
      });
    }
  }

  return items.sort((a, b) => a.date - b.date).slice(0, count);
}
