import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import TabNav from './components/TabNav.jsx';
import { BoredModal, AskModal, ActionPill } from './components/QuickActions.jsx';
import VirtualKeyboard from './components/VirtualKeyboard.jsx';
import StickyNote from './components/StickyNote.jsx';
import Today from './tabs/Today.jsx';
import Chores from './tabs/Chores.jsx';
import Calendar from './tabs/Calendar.jsx';
import Meals from './tabs/Meals.jsx';
import Points from './tabs/Points.jsx';
import Admin from './tabs/Admin.jsx';
import { api, todayStr } from './api.js';

const TABS = [
  { id: 'today',    label: 'Today' },
  { id: 'chores',   label: 'Chores' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'meals',    label: 'Meals' },
  // Points tab is hidden for now — coming back later when the reward
  // system is fleshed out. Underlying tables and routes are untouched.
  { id: 'admin',    label: 'Admin' },
];

export default function App() {
  const [tab, setTab] = useState('today');
  const [kids, setKids] = useState([]);
  const [boredOpen, setBoredOpen] = useState(false);
  const [askOpen, setAskOpen]     = useState(false);
  // Date key — bumps when the local day rolls over so each tab remounts
  // with fresh state at midnight (otherwise chores/events stay frozen on
  // yesterday's date until someone reloads).
  const [dateKey, setDateKey] = useState(todayStr());

  async function loadKids() {
    try {
      setKids(await api.kids());
    } catch (e) {
      console.error('Failed to load kids', e);
    }
  }

  useEffect(() => { loadKids(); }, []);
  useEffect(() => {
    const id = setInterval(() => loadKids(), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayStr();
      setDateKey(prev => (prev === t ? prev : t));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen w-screen flex flex-col bg-slate-100 text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="bg-white border-b border-slate-200 flex items-stretch">
        <div className="flex-1 min-w-0 flex flex-col">
          <Header bare />
          <TabNav tabs={TABS} current={tab} onChange={setTab} bare />
        </div>
        <StickyNote />
        <div className="flex self-start gap-2 p-3 flex-shrink-0">
          <ActionPill kind="bored" onClick={() => setBoredOpen(true)} />
          <ActionPill kind="ask"   onClick={() => setAskOpen(true)} />
        </div>
      </div>
      <main className="flex-1 lg:overflow-hidden">
        {tab === 'today'    && <Today    key={dateKey} kids={kids} onKidsChange={loadKids} />}
        {tab === 'chores'   && <Chores   key={dateKey} kids={kids} onKidsChange={loadKids} />}
        {tab === 'calendar' && <Calendar key={dateKey} kids={kids} />}
        {tab === 'meals'    && <Meals    key={dateKey} />}
        {tab === 'points'   && <Points   key={dateKey} kids={kids} onKidsChange={loadKids} />}
        {tab === 'admin'    && <Admin    key={dateKey} kids={kids} onKidsChange={loadKids} />}
      </main>
      {boredOpen && <BoredModal onClose={() => setBoredOpen(false)} />}
      {askOpen   && <AskModal kids={kids} onClose={() => setAskOpen(false)} />}
      <VirtualKeyboard />
    </div>
  );
}
