export default function TabNav({ tabs, current, onChange }) {
  return (
    <nav className="flex gap-1 px-3 py-2 lg:px-6 lg:py-3 bg-white border-b border-slate-200 overflow-x-auto whitespace-nowrap">
      {tabs.map(t => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-3 py-2 lg:px-5 lg:py-2.5 rounded-xl text-base lg:text-lg font-semibold transition tap flex-shrink-0
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
