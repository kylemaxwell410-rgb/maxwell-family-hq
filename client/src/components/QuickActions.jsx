import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { fetchWeather, isWetForecast } from '../utils/weather.js';
import { suggestActivity } from '../utils/bored.js';

/* Reusable modal shell */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 w-[560px] max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}>
        {title && <h3 className="text-xl font-bold mb-3 text-slate-900">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

/* I'm Bored — picks an activity from the curated list, weather-aware. */
export function BoredModal({ onClose }) {
  const [wet, setWet] = useState(false);
  const [idea, setIdea] = useState(() => suggestActivity({ wet: false }));
  useEffect(() => {
    let alive = true;
    fetchWeather().then(w => { if (alive) setWet(isWetForecast(w)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <Modal onClose={onClose} title="Try this!">
      <div className="px-1 py-2">
        <div className="text-2xl mb-2 emoji">{wet ? '☔️' : '☀️'}</div>
        <p className="text-xl font-semibold text-slate-900 leading-snug">{idea}</p>
        <p className="text-xs text-slate-500 mt-2">{wet ? 'Indoor pick — looks wet today.' : 'Get outside!'}</p>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={() => setIdea(suggestActivity({ wet, prev: idea }))}
          className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-xl font-semibold tap">
          Another idea
        </button>
        <button onClick={onClose}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Close</button>
      </div>
    </Modal>
  );
}

/* Ask Max — talks to the bot endpoint, with optional voice input. */
export function AskModal({ kids, onClose }) {
  const onlyKids = kids.filter(k => k.role === 'kid');
  const [question, setQuestion] = useState('');
  const [kidName, setKidName]   = useState(onlyKids[0]?.name || '');
  const [answer, setAnswer]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);

  const speechSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function toggleMic() {
    if (!speechSupported) {
      setError('Voice input not supported in this browser. Connect a USB mic and use a recent Chromium.');
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Recog();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (ev) => {
      let text = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      setQuestion(prev => (prev ? prev.replace(/\s+$/, '') + ' ' : '') + text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => { setListening(false); setError('Mic error: ' + e.error); };
    recogRef.current = r;
    setError(null);
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  }

  async function ask() {
    if (!question.trim()) return;
    setLoading(true); setError(null); setAnswer('');
    try {
      const r = await api.askBot(question, kidName);
      setAnswer(r.answer);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Ask Max">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Who's asking?</label>
          <div className="flex flex-wrap gap-2">
            {onlyKids.map(k => (
              <button key={k.id} onClick={() => setKidName(k.name)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold tap border
                  ${kidName === k.name ? 'border-slate-400 bg-slate-100' : 'border-slate-200 hover:bg-slate-50'}`}>
                {k.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Your question</label>
            {speechSupported && (
              <button onClick={toggleMic}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tap
                  ${listening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                <span className="emoji">🎤</span>
                {listening ? 'Listening…' : 'Voice'}
              </button>
            )}
          </div>
          <textarea
            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-base text-slate-900 min-h-[88px]"
            placeholder={listening ? 'Listening — speak now' : 'What do you want to know?'}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            autoFocus
          />
        </div>
        {answer && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-slate-900 whitespace-pre-wrap text-sm">
            {answer}
          </div>
        )}
        {error && <div className="text-rose-600 text-sm">{error}</div>}
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={ask} disabled={loading || !question.trim()}
          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold tap">
          {loading ? 'Thinking…' : answer ? 'Ask another' : 'Ask Max'}
        </button>
        <button onClick={onClose}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold tap">Close</button>
      </div>
    </Modal>
  );
}

/* Pill action button used in the header */
export function ActionPill({ kind, onClick }) {
  const styles = kind === 'bored'
    ? { bg: 'bg-amber-400 hover:bg-amber-300 text-slate-900', emoji: '💡', label: "I'm Bored" }
    : { bg: 'bg-indigo-600 hover:bg-indigo-500 text-white',     emoji: '💬', label: 'Ask Max' };
  return (
    <button onClick={onClick}
      className={`px-4 h-11 rounded-full ${styles.bg} shadow flex items-center gap-2 font-semibold tap`}>
      <span className="emoji text-xl">{styles.emoji}</span>
      <span>{styles.label}</span>
    </button>
  );
}
