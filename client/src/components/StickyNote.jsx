import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Sticky-note panel for the upper-right corner of the chrome. Yellow,
// slightly tilted, with a piece of "tape" up top. Shows the most recent
// active family note. Tap to add/edit (PIN-gated).
export default function StickyNote() {
  const [notes, setNotes] = useState([]);
  const [editing, setEditing] = useState(false);

  async function load() {
    try { setNotes(await api.notes()); } catch {}
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Show the newest note (last one created within the active set).
  const latest = notes[0];
  const extra = notes.length - 1;

  return (
    <>
      <button onClick={() => setEditing(true)}
        className="hidden lg:block flex-shrink-0 self-stretch w-[280px] mr-3 my-2 tap text-left relative"
        title="Tap to add or edit a sticky note">
        <div
          className="absolute inset-0 px-4 py-3 overflow-hidden"
          style={{
            background: 'linear-gradient(170deg, #fef3c7 0%, #fde68a 100%)',
            border: '1px solid #f59e0b33',
            boxShadow: '2px 6px 14px rgba(120, 80, 0, 0.18), 0 1px 2px rgba(0,0,0,0.06)',
            transform: 'rotate(-1.4deg)',
            borderRadius: 6,
          }}>
          {/* Tape */}
          <div className="absolute -top-2 left-1/2 w-16 h-5 bg-amber-200/70 border border-amber-300/40"
            style={{ transform: 'translateX(-50%) rotate(-2deg)' }} />
          <div className="text-[11px] uppercase tracking-widest text-amber-700 font-bold flex items-center gap-1 mt-1">
            <span className="emoji">📝</span> Sticky Note
          </div>
          {latest ? (
            <>
              <div className="mt-1 text-amber-950 leading-snug overflow-hidden break-words"
                style={{
                  fontFamily: "'Caveat', 'Permanent Marker', cursive",
                  fontWeight: 700,
                  fontSize: '1.6rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                {latest.body}
              </div>
              {extra > 0 && (
                <div className="absolute bottom-1.5 right-3 text-[11px] text-amber-700 font-bold">
                  +{extra} more
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 text-amber-700/80 italic text-sm" style={{ fontFamily: "'Caveat', cursive", fontSize: '1.4rem' }}>
              Tap to write a note…
            </div>
          )}
        </div>
      </button>
      {editing && <NoteEditModal notes={notes} onClose={async () => { setEditing(false); await load(); }} />}
    </>
  );
}

function NoteEditModal({ notes, onClose }) {
  const [pin, setPin] = useState('');
  const [body, setBody] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!body.trim()) return;
    if (!/^\d{4,}$/.test(pin)) { setErr('Enter the 4-digit Admin PIN.'); return; }
    setBusy(true); setErr(null);
    try {
      await api.addNote(pin, body.trim(), expires || null);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!/^\d{4,}$/.test(pin)) { setErr('Enter the Admin PIN to remove.'); return; }
    setBusy(true); setErr(null);
    try { await api.deleteNote(pin, id); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
    // refresh by re-opening
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-[520px] max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-3 text-slate-900">Sticky note</h3>

        {notes.length > 0 && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Active notes</div>
            <ul className="space-y-1.5">
              {notes.map(n => (
                <li key={n.id} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="flex-1 text-sm text-slate-800 whitespace-pre-wrap">{n.body}</div>
                  <button onClick={() => remove(n.id)} className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded text-xs font-semibold tap">Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">New note</div>
          <textarea className="w-full bg-white border border-slate-300 rounded-xl p-3 text-base text-slate-900 min-h-[80px]"
            placeholder="What's the family update?"
            value={body} onChange={e => setBody(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" className="bg-white border border-slate-300 rounded-xl p-2 text-sm"
              value={expires} onChange={e => setExpires(e.target.value)} />
            <input type="password" placeholder="Admin PIN" inputMode="numeric"
              className="bg-white border border-slate-300 rounded-xl p-2 text-sm"
              value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          {err && <div className="text-rose-600 text-sm">{err}</div>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={busy || !body.trim()}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-semibold tap">
            {busy ? 'Saving…' : 'Save note'}
          </button>
          <button onClick={onClose}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Close</button>
        </div>
      </div>
    </div>
  );
}
