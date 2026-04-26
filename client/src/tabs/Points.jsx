import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Points({ kids: allKids, onKidsChange }) {
  const kids = allKids.filter(k => k.role === 'kid');
  const [rewards, setRewards] = useState([]);
  const [txns, setTxns] = useState([]);
  const [selectedKid, setSelectedKid] = useState(null);
  const [confirming, setConfirming] = useState(null);

  async function load() {
    const [r, t] = await Promise.all([api.rewards(), api.transactions()]);
    setRewards(r);
    setTxns(t);
  }
  useEffect(() => { load(); }, []);

  async function redeem(kid, reward) {
    try {
      await api.redeem(kid.id, reward.id);
      setConfirming(null);
      await load();
      onKidsChange?.();
    } catch (e) {
      alert(e.message);
    }
  }

  const visibleTxns = selectedKid ? txns.filter(t => t.kid_id === selectedKid) : txns;

  return (
    <div className="h-full flex gap-4 p-6 overflow-hidden">
      <section className="flex-1 flex flex-col min-w-0 gap-4 overflow-hidden">
        <div className="grid grid-cols-4 gap-4">
          {kids.map(kid => (
            <button key={kid.id}
              onClick={() => setSelectedKid(sk => sk === kid.id ? null : kid.id)}
              className={`p-5 rounded-2xl border tap text-left transition
                ${selectedKid === kid.id ? 'border-slate-400' : 'border-slate-200 hover:border-slate-300'}`}
              style={{ background: kid.color + '22' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                  style={{ background: kid.color }}>{kid.initials}</div>
                <div className="font-semibold">{kid.name}</div>
              </div>
              <div className="text-4xl font-extrabold tabular-nums">{kid.points_balance}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">points</div>
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-lg">Rewards</h3>
            {selectedKid && (
              <div className="text-sm text-slate-500">
                Redeeming for <span className="font-semibold">{allKids.find(k => k.id === selectedKid)?.name}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 p-4 overflow-auto">
            {rewards.map(r => {
              const kid = allKids.find(k => k.id === selectedKid);
              const canAfford = kid && kid.points_balance >= r.cost;
              const disabled = !kid || !canAfford;
              return (
                <button key={r.id}
                  disabled={disabled}
                  onClick={() => setConfirming(r)}
                  className={`p-4 rounded-xl text-left tap transition border border-slate-200
                    ${disabled
                      ? 'bg-slate-50 opacity-50'
                      : 'bg-white hover:bg-slate-50'}`}>
                  <div className="text-base font-semibold mb-1">{r.label}</div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: kid?.color || '#94a3b8' }}>
                    {r.cost}
                  </div>
                  <div className="text-xs text-slate-500 uppercase">points</div>
                </button>
              );
            })}
          </div>
          {!selectedKid && (
            <div className="p-4 border-t border-slate-200 text-sm text-slate-500 text-center">
              Select a kid above to redeem
            </div>
          )}
        </div>
      </section>

      <aside className="w-[380px] flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-lg">Transactions</h3>
          <p className="text-xs text-slate-500">
            {selectedKid ? allKids.find(k => k.id === selectedKid)?.name : 'All kids'}
          </p>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-slate-200">
          {visibleTxns.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">No transactions yet</div>
          )}
          {visibleTxns.map(t => {
            const kid = allKids.find(k => k.id === t.kid_id);
            return (
              <div key={t.id} className="p-3 flex items-center gap-3">
                <div className="w-2 h-10 rounded-full" style={{ background: kid?.color || '#334155' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.reason}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12: true })}
                    {!selectedKid && kid && ` · ${kid.name}`}
                  </div>
                </div>
                <div className={`text-base font-bold tabular-nums ${t.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.amount >= 0 ? '+' : ''}{t.amount}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {confirming && selectedKid && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-slate-300 rounded-2xl p-6 w-[420px]">
            <h3 className="text-xl font-bold mb-2">Redeem reward?</h3>
            <p className="text-slate-500 mb-4">
              Spend <span className="font-bold text-slate-900">{confirming.cost} points</span> for <span className="font-bold text-slate-900">{confirming.label}</span>.
            </p>
            <div className="flex gap-2">
              <button onClick={() => redeem(allKids.find(k => k.id === selectedKid), confirming)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold tap">Confirm</button>
              <button onClick={() => setConfirming(null)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
