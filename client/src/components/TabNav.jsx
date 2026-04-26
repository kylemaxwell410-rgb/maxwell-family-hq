export default function TabNav({ tabs, current, onChange }) {
  return (
    <nav className="flex gap-1 px-6 py-3 bg-white border-b border-slate-200">
      {tabs.map(t => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-5 py-2.5 rounded-xl text-lg font-semibold transition tap
              ${active
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
