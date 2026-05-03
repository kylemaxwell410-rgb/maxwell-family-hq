import { useState } from 'react';

const CLUES = [
  { clue: '🦁👑',       answer: 'lion king',       hint: 'Disney movie' },
  { clue: '❄️👸',       answer: 'frozen',           hint: 'Disney movie' },
  { clue: '🐠🔍',       answer: 'finding nemo',     hint: 'Pixar movie' },
  { clue: '🕷️👦',       answer: 'spider-man',       hint: 'Marvel superhero' },
  { clue: '🚀🤠',       answer: 'toy story',        hint: 'Pixar movie' },
  { clue: '🐭👩‍🍳🍽️',   answer: 'ratatouille',     hint: 'Pixar movie' },
  { clue: '🤖❤️🌱',    answer: 'wall-e',            hint: 'Pixar movie' },
  { clue: '👸😴💋',     answer: 'sleeping beauty',  hint: 'Disney movie' },
  { clue: '🐟💙',       answer: 'finding dory',     hint: 'Pixar movie' },
  { clue: '🐻🍯',       answer: 'winnie the pooh',  hint: 'Classic bear' },
  { clue: '🧜‍♀️🌊',    answer: 'little mermaid',   hint: 'Disney movie' },
  { clue: '👸🍎😴',     answer: 'snow white',       hint: 'Disney movie' },
  { clue: '🧙‍♂️⚡👓',   answer: 'harry potter',     hint: 'Young wizard' },
  { clue: '🏴‍☠️🗺️',    answer: 'pirates',          hint: 'Swashbuckling adventure' },
  { clue: '🦸‍♀️🔴🌟',  answer: 'wonder woman',     hint: 'DC superhero' },
  { clue: '🦖🌴🎢',     answer: 'jurassic park',    hint: 'Dinosaur movie' },
  { clue: '👻👻👻🚫',   answer: 'ghostbusters',     hint: 'Who you gonna call?' },
  { clue: '🧊💎🧊',     answer: 'frozen',           hint: 'Ice queen' },
  { clue: '🦋🐛',       answer: 'metamorphosis',    hint: 'Nature process' },
  { clue: '🌈🐄',       answer: 'rainbow',          hint: 'Colorful sky thing' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EmojiQuiz() {
  const [deck] = useState(() => shuffle(CLUES));
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showHint, setShowHint] = useState(false);

  const current = deck[idx % deck.length];

  function next() {
    setIdx(i => i + 1);
    setInput('');
    setFeedback('');
    setShowHint(false);
  }

  function submit() {
    const normalized = input.trim().toLowerCase().replace(/[-\s]+/g, ' ');
    const target = current.answer.replace(/[-\s]+/g, ' ');
    if (normalized === target) {
      setScore(s => s + 1);
      setFeedback('Correct! 🎉');
      setTimeout(next, 800);
    } else {
      setFeedback('Not quite, try again!');
      setTimeout(() => setFeedback(''), 700);
    }
  }

  function skip() {
    setFeedback(`Answer: "${current.answer}"`);
    setTimeout(next, 1200);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-slate-400 mb-1">Score: {score}</div>
      <div className="text-sm text-slate-500 mb-3">What movie or thing does this represent?</div>
      <div className="text-6xl mb-3 tracking-widest">{current.clue}</div>
      {showHint
        ? <div className="text-xs text-amber-600 mb-2">Hint: {current.hint}</div>
        : <button onClick={() => setShowHint(true)} className="text-xs text-slate-400 underline mb-2">Show hint</button>
      }
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        autoFocus
        placeholder="Your answer…"
        className="w-48 text-center text-lg border-2 border-slate-300 rounded-xl p-2 mb-3 focus:border-indigo-500 outline-none"
      />
      <div className="flex gap-2">
        <button onClick={submit} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
          Check
        </button>
        <button onClick={skip} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
          Skip
        </button>
      </div>
      {feedback && (
        <div className={`mt-3 text-lg font-bold ${
          feedback.startsWith('Correct') ? 'text-emerald-600' :
          feedback.startsWith('Answer') ? 'text-slate-600' :
          'text-rose-600'
        }`}>
          {feedback}
        </div>
      )}
    </div>
  );
}
