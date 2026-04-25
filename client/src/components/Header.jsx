import { useEffect, useState } from 'react';
import Weather from './Weather.jsx';

const TZ = 'America/New_York';
const DATE_OPTS = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: TZ };
const TIME_OPTS = { hour: 'numeric', minute: '2-digit', timeZone: TZ };

export default function Header() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString(undefined, DATE_OPTS);
  const time = now.toLocaleTimeString(undefined, TIME_OPTS);

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Maxwell Family</h1>
        <div className="text-sm text-slate-500 mt-0.5">{date}</div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-1.5">
          <div className="text-4xl font-semibold tabular-nums tracking-tight text-slate-900">{time}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">ET</div>
        </div>
        <Weather />
      </div>
    </header>
  );
}
