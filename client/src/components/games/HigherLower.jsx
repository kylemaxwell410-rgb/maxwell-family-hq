import { useState } from 'react';

function rand() { return Math.floor(Math.random() * 100) + 1; }

export default function HigherLower() {
  const [current, setCurrent] = useState(rand);
  const [next, setNext] = useState(rand);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState('playing'); // playing | reveal | over
  const [correct, setCorrect] = useState(null);

  function guess(dir) {
    if (phase !== 'playing') return;
    const isCorrect = dir === 'higher' ? next >= current : next <= current;
    setCorrect(isCorrect);
    setPhase('reveal');
    setTimeout(() => {
      if (isCorrect) {
        const ns = score + 1;
        setScore(ns);
        setBest(b => Math.max(b, ns));
        setCurrent(next);
        setNext(rand());
        setPhase('playing');
        setCorrect(null);
      } else {
        setPhase('over');
      }
    }, 1000);
  }

  function reset() {
    setCurrent(rand());
    setNext(rand());
    setScore(0);
    setPhase('playing');
    setCorrect(null);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-5 mb-4 text-sm font-semibold text-slate-500">
        <span>Score: {score}</span>
        <span>Best: {best}</span>
      </div>

      <div className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Current number</div>
      <div className="text-7xl font-bold tabular-nums mb-4">{current}</div>

      <div className="text-sm text-slate-500 mb-1">Will the next number be higher or lower?</div>
      <div className={`text-5xl font-bold tabular-nums mb-4 transition-colors ${
        phase !== 'playing' ? 'text-slate-700' : 'text-slate-200'
      }`}>
        {phase !== 'playing' ? next : '?'}
      </div>

      {phase === 'reveal' && (
        <div className={`text-xl font-bold mb-3 ${correct ? 'text-emerald-600' : 'text-rose-600'}`}>
          {correct ? 'Correct! ✓' : 'Wrong! ✗'}
        </div>
      )}

      {phase === 'over' && (
        <>
          <div className="text-lg font-bold text-rose-600 mb-4">Game over! Score: {score}</div>
          <button onClick={reset} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
            Play again
          </button>
        </>
      )}

      {phase === 'playing' && (
        <div className="flex gap-3">
          <button onClick={() => guess('higher')} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl tap font-bold text-white">
            ▲ Higher
          </button>
          <button onClick={() => guess('lower')} className="px-6 py-3 bg-rose-500 hover:bg-rose-400 rounded-xl tap font-bold text-white">
            ▼ Lower
          </button>
        </div>
      )}
    </div>
  );
}
