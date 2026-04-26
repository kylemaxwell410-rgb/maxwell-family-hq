import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import TabNav from './components/TabNav.jsx';
import Today from './tabs/Today.jsx';
import Chores from './tabs/Chores.jsx';
import Calendar from './tabs/Calendar.jsx';
import Meals from './tabs/Meals.jsx';
import Points from './tabs/Points.jsx';
import Admin from './tabs/Admin.jsx';
import { api } from './api.js';

const TABS = [
  { id: 'today',    label: 'Today' },
  { id: 'chores',   label: 'Chores' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'meals',    label: 'Meals' },
  { id: 'points',   label: 'Points' },
  { id: 'admin',    label: 'Admin' },
];

export default function App() {
  const [tab, setTab] = useState('today');
  const [kids, setKids] = useState([]);

  async function loadKids() {
    try {
      setKids(await api.kids());
    } catch (e) {
      console.error('Failed to load kids', e);
    }
  }

  useEffect(() => { loadKids(); }, []);

  // Daily reset hook: reload on local midnight rollover (chores auto-reset via date-scoped completions)
  useEffect(() => {
    const id = setInterval(() => loadKids(), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
      <Header />
      <TabNav tabs={TABS} current={tab} onChange={setTab} />
      <main className="flex-1 overflow-hidden">
        {tab === 'today'    && <Today    kids={kids} onKidsChange={loadKids} />}
        {tab === 'chores'   && <Chores   kids={kids} onKidsChange={loadKids} />}
        {tab === 'calendar' && <Calendar kids={kids} />}
        {tab === 'meals'    && <Meals    />}
        {tab === 'points'   && <Points   kids={kids} onKidsChange={loadKids} />}
        {tab === 'admin'    && <Admin    kids={kids} onKidsChange={loadKids} />}
      </main>
    </div>
  );
}
