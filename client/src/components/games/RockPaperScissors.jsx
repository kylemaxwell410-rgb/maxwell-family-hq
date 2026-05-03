import { useState } from 'react';

const CHOICES = [
  { id: 'rock',     emoji: '✊', label: 'Rock',     beats: 'scissors' },
  { id: 'paper',    emoji: '✋', label: 'Paper',    beats: 'rock' },
  { id: 'scissors', emoji: '✌️', label: 'Scissors', beats: 'paper' },
];

function cpuPick() {
  return CHOICES[Math.floor(Math.random() * 3)];
}

function outcome(player, cpu) {
  if (player.id === cpu.id) return 'draw';
  return player.beats === cpu.id ? 'win' : 'lose';
}

export default function RockPaperScissors() {
  const [scores, setScores] = useState({ win: 0, lose: 0, draw: 0 });
  const [last, setLast] = useState(null);

  function play(choice) {
    const cpu = cpuPick();
    const res = outcome(choice, cpu);
    setLast({ player: choice, cpu, res });
    setScores(s => ({ ...s, [res]: s[res] + 1 }));
  }

  const resultText = last?.res === 'win'  ? 'You win! 🎉'
                   : last?.res === 'lose' ? 'You lose 😅'
                   : last?.res === 'draw' ? "It's a tie! 🤝"
                   : '';
  const resultColor = last?.res === 'win'  ? 'text-emerald-600'
                    : last?.res === 'lose' ? 'text-rose-600'
                    : 'text-slate-600';

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-5 mb-4 text-sm font-semibold">
        <span className="text-emerald-600">W: {scores.win}</span>
        <span className="text-rose-600">L: {scores.lose}</span>
        <span className="text-slate-500">T: {scores.draw}</span>
      </div>
      {last && (
        <div className="flex items-center gap-6 mb-3">
          <div className="flex flex-col items-center">
            <div className="text-5xl emoji">{last.player.emoji}</div>
            <div className="text-xs text-slate-400 mt-1">You</div>
          </div>
          <div className="text-slate-300 font-bold text-lg">vs</div>
          <div className="flex flex-col items-center">
            <div className="text-5xl emoji">{last.cpu.emoji}</div>
            <div className="text-xs text-slate-400 mt-1">CPU</div>
          </div>
        </div>
      )}
      {last && (
        <div className={`text-xl font-bold mb-4 ${resultColor}`}>{resultText}</div>
      )}
      <div className="text-sm text-slate-500 mb-2">{last ? 'Play again:' : 'Choose your move:'}</div>
      <div className="flex gap-3">
        {CHOICES.map(c => (
          <button
            key={c.id}
            onClick={() => play(c)}
            className="w-20 h-20 text-4xl bg-slate-100 hover:bg-slate-200 rounded-2xl tap flex items-center justify-center emoji"
            aria-label={c.label}
          >
            {c.emoji}
          </button>
        ))}
      </div>
      {last && (
        <button
          onClick={() => { setScores({ win: 0, lose: 0, draw: 0 }); setLast(null); }}
          className="mt-4 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl tap text-sm font-semibold"
        >
          Reset scores
        </button>
      )}
    </div>
  );
}
