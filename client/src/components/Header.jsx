import { useEffect, useState } from 'react';

const DATE_OPTS = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };

export default function Header() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString(undefined, DATE_OPTS);
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <header className="flex items-center justify-between px-8 py-5 bg-gradient-to-r from-[#0b0f14] via-[#101620] to-[#0b0f14] border-b border-white/5">
      <div className="flex items-baseline gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Maxwell Family HQ</h1>
        <span className="text-base text-slate-400">{date}</span>
      </div>
      <div className="text-4xl font-semibold tabular-nums tracking-tight">{time}</div>
    </header>
  );
}
