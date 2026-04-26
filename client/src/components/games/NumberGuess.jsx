import { useState } from 'react';

function pick() { return Math.floor(Math.random() * 50) + 1; }

export default function NumberGuess() {
  const [target, setTarget] = useState(pick);
  const [guess, setGuess] = useState(25);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState('');
  const [won, setWon] = useState(false);

  function adjust(d) {
    if (won) return;
    setGuess(g => Math.max(1, Math.min(50, g + d)));
  }

  function submit() {
    if (won) return;
    const t = tries + 1;
    setTries(t);
    if (guess === target) {
      setHint(`Got it in ${t} ${t === 1 ? 'try' : 'tries'}! 🎉`);
      setWon(true);
    } else if (guess < target) {
      setHint('Higher!');
    } else {
      setHint('Lower!');
    }
  }

  function reset() {
    setTarget(pick());
    setGuess(25);
    setTries(0);
    setHint('');
    setWon(false);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm text-slate-500 mb-2">I'm thinking of a number 1 to 50.</div>
      <div className="text-6xl font-bold tabular-nums my-3">{guess}</div>
      <div className="flex gap-2 mb-3">
        <button onClick={() => adjust(-5)} className="w-14 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl tap font-bold">-5</button>
        <button onClick={() => adjust(-1)} className="w-14 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl tap font-bold">-1</button>
        <button onClick={() => adjust(1)}  className="w-14 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl tap font-bold">+1</button>
        <button onClick={() => adjust(5)}  className="w-14 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl tap font-bold">+5</button>
      </div>
      <button onClick={submit} disabled={won}
        className={`px-8 py-3 rounded-xl tap font-bold text-white ${won ? 'bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
        Guess
      </button>
      {hint && (
        <div className={`mt-3 text-lg font-bold ${won ? 'text-emerald-600' : 'text-slate-700'}`}>
          {hint}
        </div>
      )}
      <div className="text-xs text-slate-400 mt-2">Tries: {tries}</div>
      {won && (
        <button onClick={reset} className="mt-4 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
          Play again
        </button>
      )}
    </div>
  );
}
