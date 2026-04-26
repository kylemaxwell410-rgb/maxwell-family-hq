import { useEffect, useState } from 'react';
import { ActionPill } from './QuickActions.jsx';

export default function Header({ onBored, onAsk }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <div className="flex items-baseline gap-4 min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex-shrink-0">Maxwell Family Planner</h1>
        <span className="text-base text-slate-500 truncate">{date}</span>
        <span className="text-base font-semibold text-slate-700 tabular-nums flex-shrink-0">{time}</span>
      </div>
      {(onBored || onAsk) && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {onBored && <ActionPill kind="bored" onClick={onBored} />}
          {onAsk   && <ActionPill kind="ask"   onClick={onAsk} />}
        </div>
      )}
    </header>
  );
}
