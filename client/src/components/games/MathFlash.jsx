import { useState, useEffect, useRef } from 'react';

const OPS = ['+', '-', '×'];

function newQuestion(score) {
  const level = Math.floor(score / 5);
  const op = OPS[Math.floor(Math.random() * (level >= 3 ? 3 : 2))];
  let a, b;
  if (op === '+') {
    a = Math.floor(Math.random() * 12) + 1;
    b = Math.floor(Math.random() * 12) + 1;
  } else if (op === '-') {
    a = Math.floor(Math.random() * 12) + 2;
    b = Math.floor(Math.random() * (a - 1)) + 1;
  } else {
    a = Math.floor(Math.random() * 10) + 1;
    b = Math.floor(Math.random() * 10) + 1;
  }
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { a, b, op, answer };
}

export default function MathFlash() {
  const [phase, setPhase] = useState('idle');
  const [score, setScore] = useState(0);
  const [q, setQ] = useState(() => newQuestion(0));
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);
  const scoreRef = useRef(0);

  function start() {
    scoreRef.current = 0;
    setScore(0);
    setQ(newQuestion(0));
    setInput('');
    setFeedback('');
    setTimeLeft(30);
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setPhase('over');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  function submit() {
    if (phase !== 'playing') return;
    const val = parseInt(input, 10);
    if (isNaN(val)) return;
    if (val === q.answer) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFeedback('✓');
      setInput('');
      setTimeout(() => { setFeedback(''); setQ(newQuestion(scoreRef.current)); }, 500);
    } else {
      setFeedback(`✗ ${q.answer}`);
      setInput('');
      setTimeout(() => setFeedback(''), 700);
    }
  }

  return (
    <div className="flex flex-col items-center">
      {phase === 'idle' && (
        <>
          <div className="text-sm text-slate-500 mb-3 text-center">
            Answer as many math problems as you can in 30 seconds!
          </div>
          <button onClick={start} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
            Start
          </button>
        </>
      )}
      {phase === 'playing' && (
        <>
          <div className="flex justify-between w-full mb-3">
            <span className="text-sm font-semibold text-slate-500">Score: {score}</span>
            <span className={`text-sm font-bold ${timeLeft <= 10 ? 'text-rose-600' : 'text-slate-500'}`}>{timeLeft}s</span>
          </div>
          <div className="text-4xl font-bold mb-5">{q.a} {q.op} {q.b} = ?</div>
          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
              className="w-24 text-center text-2xl font-bold border-2 border-slate-300 rounded-xl p-2 focus:border-emerald-500 outline-none"
            />
            <button onClick={submit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
              OK
            </button>
          </div>
          {feedback && (
            <div className={`text-2xl font-bold ${feedback.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {feedback}
            </div>
          )}
        </>
      )}
      {phase === 'over' && (
        <>
          <div className="text-xl font-bold text-slate-700 mb-1">Time's up!</div>
          <div className="text-6xl font-bold text-emerald-600 my-3">{score}</div>
          <div className="text-sm text-slate-500 mb-5">correct answers</div>
          <button onClick={start} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
            Play again
          </button>
        </>
      )}
    </div>
  );
}
