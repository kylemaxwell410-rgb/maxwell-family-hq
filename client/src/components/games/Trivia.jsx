import { useState, useMemo } from 'react';

const QUESTIONS = [
  { q: 'What is the largest planet in our solar system?',    a: 'Jupiter',    opts: ['Mars','Saturn','Jupiter','Neptune'] },
  { q: 'How many sides does a hexagon have?',                a: '6',          opts: ['5','6','7','8'] },
  { q: 'What color do you get mixing red and white?',        a: 'Pink',       opts: ['Purple','Orange','Pink','Peach'] },
  { q: 'What is the fastest land animal?',                   a: 'Cheetah',    opts: ['Lion','Horse','Cheetah','Leopard'] },
  { q: 'How many continents are there on Earth?',            a: '7',          opts: ['5','6','7','8'] },
  { q: 'What is the capital of France?',                     a: 'Paris',      opts: ['London','Rome','Madrid','Paris'] },
  { q: 'Which planet is known as the Red Planet?',           a: 'Mars',       opts: ['Venus','Mars','Jupiter','Mercury'] },
  { q: 'How many legs does a spider have?',                  a: '8',          opts: ['6','8','10','12'] },
  { q: 'What do bees make?',                                 a: 'Honey',      opts: ['Jam','Butter','Honey','Wax'] },
  { q: 'How many colors are in a rainbow?',                  a: '7',          opts: ['5','6','7','8'] },
  { q: 'What is 12 × 12?',                                   a: '144',        opts: ['124','132','144','148'] },
  { q: 'Which animal is the tallest on Earth?',              a: 'Giraffe',    opts: ['Elephant','Giraffe','Camel','Horse'] },
  { q: 'What language do Brazilians mostly speak?',          a: 'Portuguese', opts: ['Spanish','French','Portuguese','English'] },
  { q: 'How many bones are in the human body?',              a: '206',        opts: ['180','196','206','220'] },
  { q: 'What is H₂O commonly known as?',                    a: 'Water',      opts: ['Oxygen','Hydrogen','Salt','Water'] },
  { q: 'What is the smallest planet in our solar system?',   a: 'Mercury',    opts: ['Mars','Pluto','Mercury','Venus'] },
  { q: 'How many players are on a soccer team?',             a: '11',         opts: ['9','10','11','12'] },
  { q: 'Which ocean is the largest?',                        a: 'Pacific',    opts: ['Atlantic','Indian','Pacific','Arctic'] },
  { q: 'What does a caterpillar turn into?',                 a: 'Butterfly',  opts: ['Moth','Butterfly','Bee','Dragonfly'] },
  { q: 'How many teeth does an adult human have?',           a: '32',         opts: ['28','30','32','36'] },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Trivia() {
  const deck = useMemo(() => shuffle(QUESTIONS), []);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);

  const current = deck[idx];
  const shuffledOpts = useMemo(() => shuffle(current.opts), [idx]);

  function pick(opt) {
    if (selected !== null) return;
    setSelected(opt);
    if (opt === current.a) setScore(s => s + 1);
    setTimeout(() => {
      if (idx + 1 >= deck.length) { setDone(true); return; }
      setIdx(i => i + 1);
      setSelected(null);
    }, 1000);
  }

  function reset() {
    setIdx(0);
    setScore(0);
    setSelected(null);
    setDone(false);
  }

  if (done) return (
    <div className="flex flex-col items-center">
      <div className="text-xl font-bold mb-1">Quiz complete! 🏆</div>
      <div className="text-6xl font-bold text-emerald-600 my-3">{score}/{deck.length}</div>
      <div className="text-sm text-slate-500 mb-5">
        {score >= deck.length * 0.8 ? 'Genius! 🌟' : score >= deck.length * 0.5 ? 'Good job! 👍' : 'Keep studying!'}
      </div>
      <button onClick={reset} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl tap font-bold text-white">
        Play again
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-between w-full mb-3 text-xs text-slate-400">
        <span>{idx + 1} / {deck.length}</span>
        <span>Score: {score}</span>
      </div>
      <div className="text-base font-semibold text-slate-700 text-center mb-4 min-h-[3.5rem]">
        {current.q}
      </div>
      <div className="grid grid-cols-2 gap-2 w-full">
        {shuffledOpts.map(opt => {
          const state = selected === null ? 'idle'
            : opt === current.a ? 'correct'
            : opt === selected  ? 'wrong'
            : 'dim';
          return (
            <button
              key={opt}
              onClick={() => pick(opt)}
              disabled={selected !== null}
              className={`py-3 px-2 rounded-xl tap text-sm font-semibold text-center transition-colors ${
                state === 'correct' ? 'bg-emerald-200 text-emerald-800' :
                state === 'wrong'   ? 'bg-rose-200 text-rose-700' :
                state === 'dim'     ? 'bg-slate-100 text-slate-400' :
                'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
