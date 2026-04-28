import { useState } from 'react';
import PinModal from './PinModal.jsx';

// Edit-mode unlock control. Locked: prompts for PIN. Unlocked: shows
// remaining time and lets you tap to lock again.
export default function EditModeButton({ unlocked, secondsLeft, onUnlock, onLock }) {
  const [pinPrompt, setPinPrompt] = useState(false);
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  if (unlocked) {
    return (
      <button
        onClick={onLock}
        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tap whitespace-nowrap"
        title="Tap to lock now"
      >
        ✏️ Edit · {mm}:{ss}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setPinPrompt(true)}
        className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs tap whitespace-nowrap"
      >
        ✏️ Edit (PIN)
      </button>
      {pinPrompt && (
        <PinModal
          onVerified={(p) => { onUnlock(p); setPinPrompt(false); }}
          onCancel={() => setPinPrompt(false)}
        />
      )}
    </>
  );
}
