import { useState } from 'react';

const WORDS = [
  'family','pizza','soccer','dragon','castle','jungle','cookie','rocket',
  'wizard','bridge','flower','planet','school','winter','summer','basket',
  'turtle','monkey','dolphin','rainbow','butter','candle','garden','silver',
  'purple','thunder','blanket','chicken','penguin','trumpet',
];

function scramble(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  return result === word ? scramble(word) : result;
}

function pick() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return { word, scrambled: scramble(word) };
}

export default function WordScramble() {
  const [round, setRound] = useState(pick);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');

  function next() {
    setRound(pick());
    setInput('');
    setFeedback('');
  }

  function submit() {
    if (input.trim().toLowerCase() === round.word) {
      setScore(s => s + 1);
      setFeedback('Correct! 🎉');
      setTimeout(next, 800);
    } else {
      setFeedback('Try again!');
      setTimeout(() => setFeedback(''), 700);
    }
  }

  function skip() {
    setFeedback(`It was "${round.word}"`);
    setTimeout(next, 1000);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="text-sm text-slate-500 mb-1">Unscramble the word!</div>
      <div className="text-xs text-slate-400 mb-3">Score: {score}</div>
      <div className="text-4xl font-bold tracking-widest mb-5 text-indigo-600">
        {round.scrambled.toUpperCase()}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        autoFocus
        placeholder="Your answer…"
        className="w-44 text-center text-xl border-2 border-slate-300 rounded-xl p-2 mb-3 focus:border-indigo-500 outline-none"
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
          feedback.startsWith('It was') ? 'text-slate-600' :
          'text-rose-600'
        }`}>
          {feedback}
        </div>
      )}
    </div>
  );
}
