import { useState, useEffect } from 'react';

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWin(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

export default function TicTacToe() {
  const [board, setBoard] = useState(() => Array(9).fill(null));
  const [turn, setTurn] = useState('X');
  const winner = checkWin(board);
  const draw = !winner && board.every(c => c);

  function play(i) {
    if (board[i] || winner || turn !== 'X') return;
    const next = [...board];
    next[i] = 'X';
    setBoard(next);
    setTurn('O');
  }

  // Random-move computer (so kids actually win sometimes).
  useEffect(() => {
    if (turn !== 'O' || winner || draw) return;
    const empty = board.map((c, i) => c ? null : i).filter(i => i !== null);
    if (empty.length === 0) return;
    const choice = empty[Math.floor(Math.random() * empty.length)];
    const t = setTimeout(() => {
      setBoard(b => {
        const next = [...b];
        next[choice] = 'O';
        return next;
      });
      setTurn('X');
    }, 450);
    return () => clearTimeout(t);
  }, [turn, board, winner, draw]);

  function reset() {
    setBoard(Array(9).fill(null));
    setTurn('X');
  }

  const status = winner === 'X' ? 'You win! 🎉'
               : winner === 'O' ? 'Computer wins'
               : draw ? 'Tie game'
               : turn === 'X' ? 'Your turn'
               : 'Computer thinking…';

  return (
    <div className="flex flex-col items-center">
      <div className={`text-base font-bold mb-3 ${winner === 'X' ? 'text-emerald-600' : 'text-slate-700'}`}>{status}</div>
      <div className="grid grid-cols-3 gap-2">
        {board.map((c, i) => (
          <button
            key={i}
            onClick={() => play(i)}
            disabled={!!c || !!winner || turn !== 'X'}
            className={`w-20 h-20 rounded-xl text-4xl font-bold tap ${
              c === 'X' ? 'bg-blue-100 text-blue-600' :
              c === 'O' ? 'bg-rose-100 text-rose-600' :
              'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {c || ''}
          </button>
        ))}
      </div>
      {(winner || draw) && (
        <button onClick={reset} className="mt-4 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
          New game
        </button>
      )}
    </div>
  );
}
