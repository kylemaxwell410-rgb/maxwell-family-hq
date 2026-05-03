import { useState } from 'react';

const ROWS = 6;
const COLS = 7;

function emptyBoard() {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
}

function dropPiece(board, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) {
      const next = board.map(row => [...row]);
      next[r][col] = player;
      return next;
    }
  }
  return null;
}

function checkWin(board) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (const [dr, dc] of dirs) {
        let win = true;
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== p) {
            win = false;
            break;
          }
        }
        if (win) return p;
      }
    }
  }
  return null;
}

function cpuMove(board) {
  const open = [];
  for (let c = 0; c < COLS; c++) {
    if (!board[0][c]) open.push(c);
  }
  return open[Math.floor(Math.random() * open.length)];
}

export default function ConnectFour() {
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState('R');
  const [winner, setWinner] = useState(null);
  const [thinking, setThinking] = useState(false);

  function play(col) {
    if (winner || turn !== 'R' || thinking) return;
    const next = dropPiece(board, col, 'R');
    if (!next) return;
    const w = checkWin(next);
    setBoard(next);
    if (w || next.every(row => row.every(c => c))) {
      setWinner(w || 'draw');
      return;
    }
    setTurn('Y');
    setThinking(true);
    setTimeout(() => {
      const col2 = cpuMove(next);
      const next2 = dropPiece(next, col2, 'Y');
      const w2 = checkWin(next2);
      setBoard(next2);
      setWinner(w2 || (next2.every(row => row.every(c => c)) ? 'draw' : null));
      setTurn('R');
      setThinking(false);
    }, 500);
  }

  function reset() {
    setBoard(emptyBoard());
    setTurn('R');
    setWinner(null);
    setThinking(false);
  }

  const status =
    winner === 'R'    ? 'You win! 🎉' :
    winner === 'Y'    ? 'CPU wins! 🤖' :
    winner === 'draw' ? "It's a draw!" :
    thinking          ? 'CPU thinking…' :
    'Your turn — drop a 🔴';

  return (
    <div className="flex flex-col items-center">
      <div className={`text-base font-bold mb-3 ${
        winner === 'R' ? 'text-emerald-600' :
        winner === 'Y' ? 'text-rose-600' :
        'text-slate-700'
      }`}>
        {status}
      </div>
      <div className="bg-blue-600 p-2 rounded-xl">
        {board.map((row, r) => (
          <div key={r} className="flex gap-1.5 mb-1.5 last:mb-0">
            {row.map((cell, c) => (
              <button
                key={c}
                onClick={() => play(c)}
                disabled={!!winner || turn !== 'R' || thinking}
                className={`w-9 h-9 rounded-full tap transition-colors ${
                  cell === 'R' ? 'bg-red-500' :
                  cell === 'Y' ? 'bg-yellow-400' :
                  'bg-blue-200 hover:bg-blue-100'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      {winner && (
        <button onClick={reset} className="mt-4 px-5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl tap font-semibold">
          New game
        </button>
      )}
    </div>
  );
}
