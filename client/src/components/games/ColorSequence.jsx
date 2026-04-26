import { useState, useEffect, useRef } from 'react';

const COLORS = [
  { id: 0, on: 'bg-rose-500',    off: 'bg-rose-200' },
  { id: 1, on: 'bg-amber-400',   off: 'bg-amber-200' },
  { id: 2, on: 'bg-emerald-500', off: 'bg-emerald-200' },
  { id: 3, on: 'bg-sky-500',     off: 'bg-sky-200' },
];

export default function ColorSequence() {
  const [sequence, setSequence] = useState([]);
  const [active, setActive] = useState(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | showing | input | gameover
  const [score, setScore] = useState(0);
  const timeouts = useRef([]);

  function clearTimeouts() {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }

  function start() {
    clearTimeouts();
    setSequence([Math.floor(Math.random() * 4)]);
    setStep(0);
    setScore(0);
    setPhase('showing');
  }

  // Show the sequence one tile at a time.
  useEffect(() => {
    if (phase !== 'showing') return;
    clearTimeouts();
    sequence.forEach((id, i) => {
      timeouts.current.push(setTimeout(() => setActive(id),  i * 700 + 200));
      timeouts.current.push(setTimeout(() => setActive(null), i * 700 + 600));
    });
    timeouts.current.push(setTimeout(() => setPhase('input'), sequence.length * 700 + 400));
    return clearTimeouts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sequence]);

  function tap(id) {
    if (phase !== 'input') return;
    setActive(id);
    setTimeout(() => setActive(null), 200);
    if (sequence[step] !== id) {
      setPhase('gameover');
      return;
    }
    if (step + 1 === sequence.length) {
      setScore(s => s + 1);
      setStep(0);
      const next = [...sequence, Math.floor(Math.random() * 4)];
      setTimeout(() => {
        setSequence(next);
        setPhase('showing');
      }, 600);
    } else {
      setStep(step + 1);
    }
  }

  const status = phase === 'idle'     ? 'Tap Start to play'
               : phase === 'showing'  ? 'Watch carefully…'
               : phase === 'input'    ? 'Repeat the sequence!'
               : `Game over — score ${score}`;

  return (
    <div className="flex flex-col items-center">
      <div className={`text-base font-bold mb-3 ${phase === 'gameover' ? 'text-rose-600' : 'text-slate-700'}`}>
        {status}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => tap(c.id)}
            disabled={phase !== 'input'}
            className={`w-24 h-24 rounded-2xl tap transition-colors ${active === c.id ? c.on : c.off}`}
            aria-label={`Color ${c.id}`}
          />
        ))}
      </div>
      <div className="mt-3 text-xs text-slate-400">Score: {score}</div>
      {(phase === 'idle' || phase === 'gameover') && (
        <button onClick={start} className="mt-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
          {phase === 'gameover' ? 'Try again' : 'Start'}
        </button>
      )}
    </div>
  );
}
