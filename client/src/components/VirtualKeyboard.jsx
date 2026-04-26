import { useEffect, useRef, useState } from 'react';

const ROW1 = ['1','2','3','4','5','6','7','8','9','0'];
const ROW2 = ['q','w','e','r','t','y','u','i','o','p'];
const ROW3 = ['a','s','d','f','g','h','j','k','l'];
const ROW4 = ['z','x','c','v','b','n','m',',','.'];

const SHIFT_MAP = {
  '1':'!','2':'@','3':'#','4':'$','5':'%','6':'^','7':'&','8':'*','9':'(','0':')',
  ',':'<','.':'>',
};

function isEditable(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const t = (el.type || 'text').toLowerCase();
    return ['text','search','email','tel','url','password','number','date','time'].includes(t);
  }
  return false;
}

// Set value through React's prototype setter so controlled inputs see the change.
function setReactValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function VirtualKeyboard() {
  const [target, setTarget] = useState(null);
  const [shift, setShift]   = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    function onFocusIn(e) {
      if (isEditable(e.target)) {
        setTarget(e.target);
        targetRef.current = e.target;
      }
    }
    // Hide if user taps anywhere that's not an editable element AND not the keyboard itself.
    function onPointerDown(e) {
      if (e.target.closest?.('[data-vk]')) return; // keyboard tap
      if (isEditable(e.target)) return;            // tapping another input
      setTarget(null);
      targetRef.current = null;
    }
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, []);

  function press(ch) {
    const el = targetRef.current;
    if (!el) return;
    const v = el.value ?? '';
    const start = el.selectionStart ?? v.length;
    const end   = el.selectionEnd   ?? v.length;
    const next = v.slice(0, start) + ch + v.slice(end);
    setReactValue(el, next);
    requestAnimationFrame(() => {
      try { el.setSelectionRange(start + ch.length, start + ch.length); } catch {}
      el.focus();
    });
  }

  function backspace() {
    const el = targetRef.current;
    if (!el) return;
    const v = el.value ?? '';
    const start = el.selectionStart ?? v.length;
    const end   = el.selectionEnd   ?? v.length;
    if (start === 0 && end === 0) return;
    const cut = start === end ? Math.max(0, start - 1) : start;
    const next = v.slice(0, cut) + v.slice(end);
    setReactValue(el, next);
    requestAnimationFrame(() => {
      try { el.setSelectionRange(cut, cut); } catch {}
      el.focus();
    });
  }

  function enter() {
    const el = targetRef.current;
    if (!el) return;
    if (el.tagName === 'TEXTAREA') {
      press('\n');
    } else {
      // Submit by dispatching an Enter keydown — the consuming form/component decides.
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
    }
  }

  function hide() {
    targetRef.current?.blur();
    setTarget(null);
    targetRef.current = null;
    setShift(false);
  }

  if (!target) return null;

  // mouseDown.preventDefault on every key prevents the input from losing focus.
  const keyClass = 'select-none flex-1 min-w-[44px] h-14 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-200 text-slate-900 text-lg font-semibold flex items-center justify-center';
  function K({ value, label, wide, color, onPress }) {
    return (
      <button
        data-vk
        onMouseDown={e => e.preventDefault()}
        onClick={() => (onPress ? onPress() : press(shift ? (SHIFT_MAP[value] || value.toUpperCase()) : value))}
        className={`${keyClass} ${wide || ''} ${color || ''}`}>
        {label || (shift ? (SHIFT_MAP[value] || value.toUpperCase()) : value)}
      </button>
    );
  }

  return (
    <div data-vk
      className="fixed left-0 right-0 bottom-0 z-50 bg-slate-100 border-t border-slate-300 shadow-2xl px-3 py-3"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="flex flex-col gap-1.5 max-w-[1400px] mx-auto">
        <div className="flex gap-1.5">
          {ROW1.map(c => <K key={c} value={c} />)}
          <K label="⌫" wide="flex-[1.5]" color="bg-slate-200" onPress={backspace} />
        </div>
        <div className="flex gap-1.5">
          {ROW2.map(c => <K key={c} value={c} />)}
        </div>
        <div className="flex gap-1.5">
          <div className="w-7" />
          {ROW3.map(c => <K key={c} value={c} />)}
          <K label="↵" wide="flex-[1.5]" color="bg-emerald-500 text-white border-emerald-500" onPress={enter} />
        </div>
        <div className="flex gap-1.5">
          <K label={shift ? '⇧' : '⇧'}
             wide="flex-[1.5]"
             color={shift ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-200'}
             onPress={() => setShift(s => !s)} />
          {ROW4.map(c => <K key={c} value={c} />)}
          <K label="?" value="?" />
        </div>
        <div className="flex gap-1.5">
          <K label="space" value=" " wide="flex-[8]" color="bg-white" />
          <K label="Hide" wide="flex-[2]" color="bg-slate-200" onPress={hide} />
        </div>
      </div>
    </div>
  );
}
