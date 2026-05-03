import { useState, useEffect, useMemo } from 'react';

const WORDS = [
  'flame','brave','chess','crisp','flute','house','kneel','lofty','maple',
  'onion','piano','quake','santa','tiger','ultra','vivid','watch','yacht',
  'zebra','apple','brush','crane','delta','eagle','forge','globe','heart',
  'jolly','laser','magic','night','ocean','peace','river','smile','trust',
  'cloud','dream','first','grace','plant','stone','light','black','white',
  'brown','green','sheep','wheat','sword','crown','water','earth','music',
  'clock','trail','solar','bloom','storm','sweet','crisp','blaze','lucky',
];

function pick() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function evaluate(guess, target) {
  const result = Array(5).fill('absent');
  const tArr = target.split('');
  const usedT = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === tArr[i]) { result[i] = 'correct'; usedT[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    for (let j = 0; j < 5; j++) {
      if (!usedT[j] && guess[i] === tArr[j]) {
        result[i] = 'present';
        usedT[j] = true;
        break;
      }
    }
  }
  return result;
}

const TILE = {
  correct: 'bg-emerald-500 text-white border-emerald-500',
  present: 'bg-amber-400  text-white border-amber-400',
  absent:  'bg-slate-400  text-white border-slate-400',
  active:  'bg-white border-slate-500',
  empty:   'bg-white border-slate-200',
};

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MAX = 6;

export default function WordleLite() {
  const [target, setTarget] = useState(pick);
  const [guesses, setGuesses] = useState([]);
  const [current, setCurrent] = useState('');
  const [phase, setPhase] = useState('playing');

  const won  = phase === 'won';
  const lost = phase === 'lost';

  function pressKey(key) {
    if (phase !== 'playing') return;
    if (key === 'ENTER') {
      if (current.length !== 5) return;
      const result = evaluate(current, target);
      const next = [...guesses, { word: current, result }];
      setGuesses(next);
      setCurrent('');
      if (current === target) { setPhase('won'); return; }
      if (next.length >= MAX) { setPhase('lost'); }
      return;
    }
    if (key === 'BACK') { setCurrent(c => c.slice(0, -1)); return; }
    if (current.length < 5) setCurrent(c => c + key);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter')     { pressKey('ENTER'); return; }
      if (e.key === 'Backspace') { pressKey('BACK'); return; }
      if (/^[a-zA-Z]$/.test(e.key)) pressKey(e.key.toLowerCase());
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function reset() {
    setTarget(pick());
    setGuesses([]);
    setCurrent('');
    setPhase('playing');
  }

  // Build letter→state map for keyboard colouring.
  const letterStates = useMemo(() => {
    const map = {};
    for (const { word, result } of guesses) {
      word.split('').forEach((l, i) => {
        const prev = map[l];
        const next = result[i];
        if (prev === 'correct') return;
        if (next === 'correct' || !prev || (next === 'present' && prev === 'absent')) map[l] = next;
      });
    }
    return map;
  }, [guesses]);

  const rows = Array(MAX).fill(null).map((_, r) => {
    if (r < guesses.length) return guesses[r];
    if (r === guesses.length && phase === 'playing') return { word: current.padEnd(5), result: null, active: true };
    return { word: '     ', result: null };
  });

  return (
    <div className="flex flex-col items-center">
      <div className={`text-sm font-bold mb-2 ${won ? 'text-emerald-600' : lost ? 'text-rose-600' : 'text-slate-500'}`}>
        {won  ? 'Brilliant! 🎉' :
         lost ? `The word was "${target.toUpperCase()}"` :
         `Guess the 5-letter word (${MAX - guesses.length} left)`}
      </div>

      <div className="flex flex-col gap-1 mb-3">
        {rows.map((row, r) => (
          <div key={r} className="flex gap-1">
            {Array(5).fill(null).map((_, c) => {
              const ch = row.word[c]?.trim() || '';
              const state = row.result ? row.result[c] : (row.active && ch ? 'active' : 'empty');
              return (
                <div
                  key={c}
                  className={`w-10 h-10 border-2 rounded flex items-center justify-center text-base font-bold uppercase ${TILE[state]}`}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {KEY_ROWS.map(row => (
          <div key={row} className="flex gap-1 justify-center">
            {row.split('').map(k => {
              const st = letterStates[k];
              return (
                <button
                  key={k}
                  onClick={() => pressKey(k)}
                  className={`w-7 h-8 rounded tap font-bold text-xs ${
                    st === 'correct' ? 'bg-emerald-500 text-white' :
                    st === 'present' ? 'bg-amber-400 text-white' :
                    st === 'absent'  ? 'bg-slate-400 text-white' :
                    'bg-slate-200 hover:bg-slate-300'
                  }`}
                >
                  {k.toUpperCase()}
                </button>
              );
            })}
          </div>
        ))}
        <div className="flex gap-1 justify-center">
          <button onClick={() => pressKey('ENTER')} className="px-2 h-8 bg-slate-200 hover:bg-slate-300 rounded tap font-bold text-xs">ENTER</button>
          <button onClick={() => pressKey('BACK')}  className="px-2 h-8 bg-slate-200 hover:bg-slate-300 rounded tap font-bold text-xs">⌫</button>
        </div>
      </div>

      {(won || lost) && (
        <button onClick={reset} className="mt-3 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
          New word
        </button>
      )}
    </div>
  );
}
