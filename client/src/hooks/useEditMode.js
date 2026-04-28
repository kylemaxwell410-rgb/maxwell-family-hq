// 5-minute admin unlock for moving chores between kids.
// PIN is verified once via PinModal; this hook persists the unlock window
// in localStorage so a refresh doesn't kick the parent out mid-edit.

import { useEffect, useState } from 'react';

const UNLOCK_KEY = 'edit_unlock_until';
const PIN_KEY    = 'admin_pin';
const WINDOW_MS  = 5 * 60 * 1000;

export function useEditMode() {
  const [unlockedUntil, setUnlockedUntil] = useState(() => {
    const v = parseInt(localStorage.getItem(UNLOCK_KEY) || '0', 10);
    return v > Date.now() ? v : 0;
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!unlockedUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= unlockedUntil) {
        localStorage.removeItem(UNLOCK_KEY);
        setUnlockedUntil(0);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [unlockedUntil]);

  // PinModal already verifies the PIN before calling this — just persist.
  function unlock(pin) {
    const until = Date.now() + WINDOW_MS;
    localStorage.setItem(UNLOCK_KEY, String(until));
    localStorage.setItem(PIN_KEY, pin);
    setUnlockedUntil(until);
  }

  function lock() {
    localStorage.removeItem(UNLOCK_KEY);
    setUnlockedUntil(0);
  }

  const unlocked = unlockedUntil > now;
  const secondsLeft = unlocked ? Math.max(0, Math.ceil((unlockedUntil - now) / 1000)) : 0;
  const pin = unlocked ? localStorage.getItem(PIN_KEY) : null;

  return { unlocked, secondsLeft, pin, unlock, lock };
}
