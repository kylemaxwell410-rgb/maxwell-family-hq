import { useState, useEffect, useRef } from 'react';

export default function ReactionTap() {
  const [phase, setPhase] = useState('idle'); // idle | waiting | ready | tooEarly | result
  const [reactionMs, setReactionMs] = useState(null);
  const [best, setBest] = useState(null);
  const startRef = useRef(null);
  const timeoutRef = useRef(null);

  function start() {
    setPhase('waiting');
    setReactionMs(null);
    const delay = 2000 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      startRef.current = Date.now();
      setPhase('ready');
    }, delay);
  }

  function tap() {
    if (phase === 'waiting') {
      clearTimeout(timeoutRef.current);
      setPhase('tooEarly');
      return;
    }
    if (phase === 'ready') {
      const ms = Date.now() - startRef.current;
      setReactionMs(ms);
      setBest(b => (b === null || ms < b ? ms : b));
      setPhase('result');
    }
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const bgClass =
    phase === 'waiting'  ? 'bg-amber-100' :
    phase === 'ready'    ? 'bg-emerald-400' :
    phase === 'tooEarly' ? 'bg-rose-200' :
    'bg-slate-100';

  const label =
    phase === 'idle'     ? 'Tap to start' :
    phase === 'waiting'  ? 'Wait…' :
    phase === 'ready'    ? 'TAP NOW!' :
    phase === 'tooEarly' ? 'Too early! 😬' :
    `${reactionMs} ms`;

  const rating =
    reactionMs < 200 ? 'Lightning fast! ⚡' :
    reactionMs < 300 ? 'Great reflexes! 🎯' :
    reactionMs < 450 ? 'Pretty good! 👍' :
    'Keep practicing!';

  const isAction = phase === 'idle' || phase === 'result' || phase === 'tooEarly';

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm text-slate-500 mb-3 text-center">
        Tap the button the instant it turns green!
      </div>
      {best !== null && (
        <div className="text-xs text-slate-400 mb-2">Best: {best} ms</div>
      )}
      <button
        onClick={isAction ? start : tap}
        className={`w-48 h-48 rounded-3xl tap font-bold text-2xl transition-colors ${bgClass} ${phase === 'ready' ? 'text-white' : 'text-slate-700'}`}
      >
        {label}
      </button>
      {phase === 'result' && reactionMs !== null && (
        <div className={`mt-3 text-lg font-bold ${
          reactionMs < 300 ? 'text-emerald-600' :
          reactionMs < 450 ? 'text-amber-600' :
          'text-slate-600'
        }`}>
          {rating}
        </div>
      )}
      {phase === 'result' && (
        <button onClick={start} className="mt-4 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
          Try again
        </button>
      )}
    </div>
  );
}
