// Daily-rotating mini-game lookup. Mirrors the factForToday() pattern in
// funFacts.js so all devices on the same day see the same game.

export const GAMES = [
  { id: 'memory', name: 'Memory Match',   emoji: '🧠' },
  { id: 'guess',  name: 'Number Guess',   emoji: '🎯' },
  { id: 'ttt',    name: 'Tic-Tac-Toe',    emoji: '⚔️' },
  { id: 'simon',  name: 'Color Sequence', emoji: '🎨' },
];

export function gameForToday(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / 86_400_000);
  return GAMES[dayOfYear % GAMES.length];
}
