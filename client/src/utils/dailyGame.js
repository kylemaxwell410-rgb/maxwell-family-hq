// Daily-rotating mini-game lookup. Mirrors the factForToday() pattern in
// funFacts.js so all devices on the same day see the same game.

export const GAMES = [
  { id: 'memory',  name: 'Memory Match',       emoji: '🧠' },
  { id: 'guess',   name: 'Number Guess',        emoji: '🎯' },
  { id: 'ttt',     name: 'Tic-Tac-Toe',         emoji: '⚔️' },
  { id: 'simon',   name: 'Color Sequence',      emoji: '🎨' },
  { id: 'math',    name: 'Math Flash',          emoji: '➕' },
  { id: 'scramble',name: 'Word Scramble',       emoji: '🔤' },
  { id: 'rps',     name: 'Rock Paper Scissors', emoji: '✊' },
  { id: 'emoji',   name: 'Emoji Quiz',          emoji: '🤔' },
  { id: 'reaction',name: 'Reaction Tap',        emoji: '⚡' },
  { id: 'hangman', name: 'Hangman',             emoji: '🪝' },
  { id: 'trivia',  name: 'Trivia',              emoji: '🏆' },
  { id: 'c4',      name: 'Connect Four',        emoji: '🔵' },
  { id: 'wordle',  name: 'Wordle Lite',         emoji: '🟩' },
  { id: 'hilo',    name: 'Higher or Lower',     emoji: '📈' },
];

export function gameForToday(date = new Date()) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / 86_400_000);
  return GAMES[dayOfYear % GAMES.length];
}
