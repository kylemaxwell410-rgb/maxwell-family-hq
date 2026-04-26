import { useEffect, useState } from 'react';
import { ActionPill } from './QuickActions.jsx';

export default function Header({ onBored, onAsk }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dateShort = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <header className="bg-white border-b border-slate-200 px-3 py-2 lg:px-6 lg:py-4
                       flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="flex items-baseline gap-2 min-w-0 lg:gap-4">
        <h1 className="text-lg lg:text-2xl font-extrabold tracking-tight text-slate-900 flex-shrink-0">Maxwell Family Planner</h1>
        <span className="hidden lg:inline text-base text-slate-500 truncate">{date}</span>
        <span className="lg:hidden text-xs text-slate-500 truncate">{dateShort}</span>
        <span className="text-sm lg:text-base font-semibold text-slate-700 tabular-nums flex-shrink-0">{time}</span>
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
