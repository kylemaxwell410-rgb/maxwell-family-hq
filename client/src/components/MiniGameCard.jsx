import { useState } from 'react';
import { gameForToday } from '../utils/dailyGame.js';
import MemoryMatch from './games/MemoryMatch.jsx';
import NumberGuess from './games/NumberGuess.jsx';
import TicTacToe from './games/TicTacToe.jsx';
import ColorSequence from './games/ColorSequence.jsx';
import MathFlash from './games/MathFlash.jsx';
import WordScramble from './games/WordScramble.jsx';
import RockPaperScissors from './games/RockPaperScissors.jsx';
import EmojiQuiz from './games/EmojiQuiz.jsx';
import ReactionTap from './games/ReactionTap.jsx';
import Hangman from './games/Hangman.jsx';
import Trivia from './games/Trivia.jsx';
import ConnectFour from './games/ConnectFour.jsx';
import WordleLite from './games/WordleLite.jsx';
import HigherLower from './games/HigherLower.jsx';

const GAME_COMPONENTS = {
  memory:   MemoryMatch,
  guess:    NumberGuess,
  ttt:      TicTacToe,
  simon:    ColorSequence,
  math:     MathFlash,
  scramble: WordScramble,
  rps:      RockPaperScissors,
  emoji:    EmojiQuiz,
  reaction: ReactionTap,
  hangman:  Hangman,
  trivia:   Trivia,
  c4:       ConnectFour,
  wordle:   WordleLite,
  hilo:     HigherLower,
};

export default function MiniGameCard({ now }) {
  const [open, setOpen] = useState(false);
  const game = gameForToday(now);
  const Game = GAME_COMPONENTS[game.id];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="surface px-3 py-2 flex flex-col items-center justify-center gap-0.5 tap min-w-[120px] hover:bg-slate-50"
      >
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Today's Game</div>
        <div className="text-3xl leading-none emoji">{game.emoji}</div>
        <div className="text-[13px] font-bold text-slate-700 text-center leading-tight">{game.name}</div>
        <div className="text-[10px] text-slate-400 leading-none">Tap to play</div>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span className="emoji">{game.emoji}</span>
                {game.name}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 tap font-bold text-lg"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {Game ? <Game /> : <div className="text-slate-500">Game not found.</div>}
          </div>
        </div>
      )}
    </>
  );
}
