// Bag, saved perfumes, preferences and order history.
// Everything is kept in this browser only (no accounts, no server).
const KEY = 'tss.v1';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { bag: v.bag || {}, saved: v.saved || [], prefs: v.prefs || { families: [], notes: [] }, orders: v.orders || [], contact: v.contact || {} };
  } catch (err) {
    return { bag: {}, saved: [], prefs: { families: [], notes: [] }, orders: [], contact: {} };
  }
}

let state = read();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    /* storage blocked: the bag still works until the page is closed */
  }
  document.dispatchEvent(new CustomEvent('store:change'));
}

addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = read();
    document.dispatchEvent(new CustomEvent('store:change'));
  }
});

export const store = {
  get bag() { return state.bag; },
  get saved() { return state.saved; },
  get prefs() { return state.prefs; },
  get orders() { return state.orders; },
  get contact() { return state.contact; },
  bagCount() { return Object.values(state.bag).reduce((a, b) => a + b, 0); },
  add(id, qty = 1) {
    state.bag[id] = Math.min(20, (state.bag[id] || 0) + qty);
    write();
  },
  setQty(id, qty) {
    if (qty <= 0) delete state.bag[id];
    else state.bag[id] = Math.min(20, qty);
    write();
  },
  clearBag() { state.bag = {}; write(); },
  isSaved(id) { return state.saved.includes(id); },
  toggleSaved(id) {
    state.saved = state.saved.includes(id) ? state.saved.filter((x) => x !== id) : [id, ...state.saved];
    write();
    return state.saved.includes(id);
  },
  setPrefs(prefs) { state.prefs = prefs; write(); },
  setContact(contact) { state.contact = contact; write(); },
  addOrder(order) { state.orders = [order, ...state.orders]; write(); },
  perfumesReserved() {
    return state.orders.reduce((n, o) => n + o.items.reduce((a, it) => a + it.qty, 0), 0);
  },
};
