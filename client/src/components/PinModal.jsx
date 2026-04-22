import { useState } from 'react';
import { api } from '../api.js';

export default function PinModal({ onVerified, onCancel }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  async function submit(val = pin) {
    try {
      await api.verifyPin(val);
      onVerified(val);
    } catch (e) {
      setErr('Invalid PIN');
      setPin('');
    }
  }

  function press(digit) {
    const next = (pin + digit).slice(0, 6);
    setPin(next);
    setErr('');
    if (next.length === 4) submit(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111923] border border-white/10 rounded-2xl p-8 w-[420px]">
        <h2 className="text-2xl font-bold mb-2">Admin PIN</h2>
        <p className="text-slate-400 text-sm mb-6">Enter 4-digit PIN</p>
        <div className="flex justify-center gap-3 mb-6">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-12 h-14 rounded-lg flex items-center justify-center text-2xl font-bold
              ${pin.length > i ? 'bg-white/10 border border-white/20' : 'bg-white/5 border border-white/5'}`}>
              {pin.length > i ? '•' : ''}
            </div>
          ))}
        </div>
        {err && <p className="text-rose-400 text-center mb-4">{err}</p>}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d} onClick={() => press(d)}
              className="py-4 text-2xl font-semibold bg-white/5 hover:bg-white/10 rounded-xl tap">{d}</button>
          ))}
          <button onClick={onCancel}
            className="py-4 text-base font-medium bg-white/5 hover:bg-white/10 rounded-xl tap">Cancel</button>
          <button onClick={() => press('0')}
            className="py-4 text-2xl font-semibold bg-white/5 hover:bg-white/10 rounded-xl tap">0</button>
          <button onClick={() => { setPin(p => p.slice(0, -1)); setErr(''); }}
            className="py-4 text-base font-medium bg-white/5 hover:bg-white/10 rounded-xl tap">⌫</button>
        </div>
      </div>
    </div>
  );
}
