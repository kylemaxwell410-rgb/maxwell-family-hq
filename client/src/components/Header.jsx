import { useEffect, useState } from 'react';

export default function Header() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200">
      <div className="flex items-baseline gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Maxwell Family Planner</h1>
        <span className="text-base text-slate-500">{date}</span>
        <span className="text-base font-semibold text-slate-700 tabular-nums">{time}</span>
      </div>
    </header>
  );
}
