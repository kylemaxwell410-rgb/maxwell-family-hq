export default function TabNav({ tabs, current, onChange }) {
  return (
    <nav className="flex gap-2 px-8 py-3 bg-[#0e141c] border-b border-white/5">
      {tabs.map(t => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-6 py-3 rounded-xl text-xl font-semibold transition tap
              ${active
                ? 'bg-white/10 text-white shadow-inner'
                : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
