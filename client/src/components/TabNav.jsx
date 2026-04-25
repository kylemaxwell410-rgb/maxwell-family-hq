export default function TabNav({ tabs, current, onChange }) {
  return (
    <nav className="flex gap-2 px-8 py-3 bg-white border-b border-slate-200">
      {tabs.map(t => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-6 py-3 rounded-xl text-xl font-semibold transition tap
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
