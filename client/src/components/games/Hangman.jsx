import { useState } from 'react';

const WORDS = [
  'rainbow','planet','cookie','dragon','castle','jungle','rocket','wizard',
  'dolphin','turtle','monkey','flower','bridge','basket','winter','summer',
  'family','soccer','school','butter','garden','candle','purple','silver',
  'thunder','blanket','chicken','penguin','trumpet','unicorn',
];

const MAX_WRONG = 6;

function pick() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

const PARTS = [
  <circle key="head" cx="50" cy="25" r="9" stroke="#334155" strokeWidth="3" fill="none" />,
  <line key="body"   x1="50" y1="34" x2="50" y2="62" stroke="#334155" strokeWidth="3" />,
  <line key="larm"   x1="50" y1="44" x2="32" y2="54" stroke="#334155" strokeWidth="3" />,
  <line key="rarm"   x1="50" y1="44" x2="68" y2="54" stroke="#334155" strokeWidth="3" />,
  <line key="lleg"   x1="50" y1="62" x2="32" y2="82" stroke="#334155" strokeWidth="3" />,
  <line key="rleg"   x1="50" y1="62" x2="68" y2="82" stroke="#334155" strokeWidth="3" />,
];

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');

export default function Hangman() {
  const [word, setWord] = useState(pick);
  const [guessed, setGuessed] = useState(new Set());

  const wrong = [...guessed].filter(l => !word.includes(l)).length;
  const won = word.split('').every(l => guessed.has(l));
  const lost = wrong >= MAX_WRONG;

  function guess(letter) {
    if (won || lost || guessed.has(letter)) return;
    setGuessed(g => new Set([...g, letter]));
  }

  function reset() {
    setWord(pick());
    setGuessed(new Set());
  }

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 95" className="w-28 h-28 mb-1">
        {/* Gallows */}
        <line x1="10" y1="92" x2="90" y2="92" stroke="#94a3b8" strokeWidth="3" />
        <line x1="28" y1="92" x2="28" y2="5"  stroke="#94a3b8" strokeWidth="3" />
        <line x1="28" y1="5"  x2="50" y2="5"  stroke="#94a3b8" strokeWidth="3" />
        <line x1="50" y1="5"  x2="50" y2="16" stroke="#94a3b8" strokeWidth="3" />
        {PARTS.slice(0, wrong)}
      </svg>

      <div className="flex gap-1 mb-3">
        {word.split('').map((l, i) => (
          <div
            key={i}
            className="w-7 h-9 border-b-2 border-slate-400 flex items-end justify-center pb-0.5 text-lg font-bold uppercase"
          >
            {guessed.has(l) || won || lost ? l : ''}
          </div>
        ))}
      </div>

      {(won || lost) && (
        <div className={`text-lg font-bold mb-2 ${won ? 'text-emerald-600' : 'text-rose-600'}`}>
          {won ? 'You got it! 🎉' : `It was "${word}"`}
        </div>
      )}
      {!won && !lost && (
        <div className="text-xs text-slate-400 mb-2">Wrong guesses: {wrong}/{MAX_WRONG}</div>
      )}

      <div className="flex flex-wrap justify-center gap-1 max-w-[260px]">
        {ALPHA.map(l => (
          <button
            key={l}
            onClick={() => guess(l)}
            disabled={guessed.has(l) || won || lost}
            className={`w-8 h-8 rounded-lg text-sm font-bold tap ${
              guessed.has(l)
                ? (word.includes(l) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-400')
                : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <button onClick={reset} className="mt-4 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
        New word
      </button>
    </div>
  );
}
