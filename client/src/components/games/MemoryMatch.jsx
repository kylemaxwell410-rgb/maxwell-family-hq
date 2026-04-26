import { useState } from 'react';

const PAIRS = ['🐶', '🐱', '🐰', '🐭', '🦊', '🐻'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshDeck() {
  return shuffle([...PAIRS, ...PAIRS]).map((emoji, i) => ({
    id: i,
    emoji,
    matched: false,
    flipped: false,
  }));
}

export default function MemoryMatch() {
  const [cards, setCards] = useState(freshDeck);
  const [flippedIdx, setFlippedIdx] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const won = cards.every(c => c.matched);

  function flip(i) {
    if (locked || cards[i].flipped || cards[i].matched) return;
    const next = cards.map((c, idx) => idx === i ? { ...c, flipped: true } : c);
    const newFlipped = [...flippedIdx, i];
    setCards(next);
    setFlippedIdx(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setLocked(true);
      const [a, b] = newFlipped;
      const match = next[a].emoji === next[b].emoji;
      setTimeout(() => {
        setCards(c => c.map((card, idx) => {
          if (idx !== a && idx !== b) return card;
          return match
            ? { ...card, matched: true }
            : { ...card, flipped: false };
        }));
        setFlippedIdx([]);
        setLocked(false);
      }, match ? 400 : 800);
    }
  }

  function reset() {
    setCards(freshDeck());
    setFlippedIdx([]);
    setMoves(0);
    setLocked(false);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm text-slate-500 mb-3">Find the matching pairs</div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <button
            key={c.id}
            onClick={() => flip(i)}
            className={`w-16 h-16 rounded-xl text-3xl flex items-center justify-center tap transition-colors ${
              c.matched ? 'bg-emerald-100' :
              c.flipped ? 'bg-slate-100' :
              'bg-slate-300 hover:bg-slate-400'
            }`}
          >
            {c.flipped || c.matched ? c.emoji : ''}
          </button>
        ))}
      </div>
      <div className="mt-4 text-sm text-slate-500">Moves: {moves}</div>
      {won && (
        <div className="mt-2 text-xl font-bold text-emerald-600">You won! 🎉</div>
      )}
      <button onClick={reset} className="mt-4 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
        New game
      </button>
    </div>
  );
}
