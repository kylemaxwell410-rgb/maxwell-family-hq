const BASE = '/api';

async function req(path, opts = {}) {
  // Spread opts FIRST, then overwrite headers with the merged version —
  // otherwise opts.headers (e.g. {x-admin-pin}) would replace our merged
  // object and drop Content-Type, which makes Express skip JSON parsing
  // and return an empty req.body to the route.
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // kids
  kids: () => req('/kids'),

  // chores
  chores: (date) => req(`/chores${date ? `?date=${date}` : ''}`),
  completeChore: (id, date) => req(`/chores/${id}/complete`, {
    method: 'POST', body: JSON.stringify({ date }),
  }),
  uncompleteChore: (id, date) => req(`/chores/${id}/uncomplete`, {
    method: 'POST', body: JSON.stringify({ date }),
  }),

  // events
  events: (from, to) => {
    const q = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
    return req(`/events${q}`);
  },
  createEvent: (body) => req('/events', { method: 'POST', body: JSON.stringify(body) }),
  updateEvent: (id, body) => req(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEvent: (id) => req(`/events/${id}`, { method: 'DELETE' }),

  // meals
  meals: (from, to) => req(`/meals?from=${from}&to=${to}`),
  upsertMeal: (body) => req('/meals', { method: 'PUT', body: JSON.stringify(body) }),

  // shopping
  shopping: () => req('/shopping'),
  addShopping: (body) => req('/shopping', { method: 'POST', body: JSON.stringify(body) }),
  patchShopping: (id, body) => req(`/shopping/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteShopping: (id) => req(`/shopping/${id}`, { method: 'DELETE' }),
  clearChecked: () => req('/shopping/clear-checked', { method: 'POST' }),

  // points
  rewards: () => req('/points/rewards'),
  transactions: (kidId) => req(`/points/transactions${kidId ? `?kid_id=${kidId}` : ''}`),
  redeem: (kid_id, reward_id) => req('/points/redeem', {
    method: 'POST', body: JSON.stringify({ kid_id, reward_id }),
  }),
  adjust: (kid_id, amount, reason) => req('/points/adjust', {
    method: 'POST', body: JSON.stringify({ kid_id, amount, reason }),
  }),

  // admin
  verifyPin: (pin) => req('/admin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  adminChores: (pin) => req('/admin/chores', { headers: { 'x-admin-pin': pin } }),
  createChore: (pin, body) => req('/admin/chores', {
    method: 'POST', headers: { 'x-admin-pin': pin }, body: JSON.stringify(body),
  }),
  updateChore: (pin, id, body) => req(`/admin/chores/${id}`, {
    method: 'PUT', headers: { 'x-admin-pin': pin }, body: JSON.stringify(body),
  }),
  deleteChore: (pin, id) => req(`/admin/chores/${id}`, {
    method: 'DELETE', headers: { 'x-admin-pin': pin },
  }),
  updateKid: (pin, id, body) => req(`/admin/kids/${id}`, {
    method: 'PUT', headers: { 'x-admin-pin': pin }, body: JSON.stringify(body),
  }),
  setChoreOverride: (pin, chore_id, override_date, kid_id) => req('/admin/chore-overrides', {
    method: 'POST', headers: { 'x-admin-pin': pin },
    body: JSON.stringify({ chore_id, override_date, kid_id }),
  }),
  clearChoreOverride: (pin, chore_id, override_date) => req('/admin/chore-overrides', {
    method: 'DELETE', headers: { 'x-admin-pin': pin },
    body: JSON.stringify({ chore_id, override_date }),
  }),
  skipChore: (pin, chore_id, skip_date) => req('/admin/chore-skips', {
    method: 'POST', headers: { 'x-admin-pin': pin },
    body: JSON.stringify({ chore_id, skip_date }),
  }),
  unskipChore: (pin, chore_id, skip_date) => req('/admin/chore-skips', {
    method: 'DELETE', headers: { 'x-admin-pin': pin },
    body: JSON.stringify({ chore_id, skip_date }),
  }),

  // settings
  settings: () => req('/settings'),
  updateSetting: (pin, key, value) => req(`/settings/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: { 'x-admin-pin': pin }, body: JSON.stringify({ value }),
  }),

  // family notes
  notes: () => req('/notes'),
  addNote: (pin, body, expires_on) => req('/notes', {
    method: 'POST', headers: { 'x-admin-pin': pin }, body: JSON.stringify({ body, expires_on }),
  }),
  updateNote: (pin, id, body, expires_on) => req(`/notes/${id}`, {
    method: 'PUT', headers: { 'x-admin-pin': pin }, body: JSON.stringify({ body, expires_on }),
  }),
  deleteNote: (pin, id) => req(`/notes/${id}`, {
    method: 'DELETE', headers: { 'x-admin-pin': pin },
  }),

  // streaks
  streaks: () => req('/streaks'),

  // vacations
  vacations: () => req('/vacations'),
  addVacation: (pin, body) => req('/vacations', {
    method: 'POST', headers: { 'x-admin-pin': pin }, body: JSON.stringify(body),
  }),
  updateVacation: (pin, id, body) => req(`/vacations/${id}`, {
    method: 'PUT', headers: { 'x-admin-pin': pin }, body: JSON.stringify(body),
  }),
  deleteVacation: (pin, id) => req(`/vacations/${id}`, {
    method: 'DELETE', headers: { 'x-admin-pin': pin },
  }),

  // bot
  askBot: (question, kid_name) => req('/bot/ask', {
    method: 'POST', body: JSON.stringify({ question, kid_name }),
  }),
  botLog: (pin, limit) => req(`/bot/log${limit ? `?limit=${limit}` : ''}`, {
    headers: { 'x-admin-pin': pin },
  }),
  clearBotLog: (pin) => req('/bot/log', {
    method: 'DELETE', headers: { 'x-admin-pin': pin },
  }),
};

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
