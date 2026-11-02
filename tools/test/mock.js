(function(){
  const docs = new Map(); const subs = new Set(); let n=0;
  const snap = () => ({ docs: Array.from(docs, ([id, v]) => ({ id, exists: true, data: () => v, metadata: {} })), size: docs.size, empty: !docs.size, docChanges: () => [], metadata: { fromCache: false } });
  const fire = () => setTimeout(() => subs.forEach((f) => f(snap())), 10);
  const db = { collection: (c) => ({ onSnapshot: (f) => { subs.add(f); fire(); return () => subs.delete(f); }, doc: (id) => ({ set: async (v) => { docs.set(id, v); fire(); }, delete: async () => { docs.delete(id); fire(); } }) }) };
  const assets = { upload: async (b) => ({ id: 'a' + (++n), url: URL.createObjectURL(b) }), delete: async () => {} };
  const user = { isOwner: () => true };
  window.__mockDocs = docs;
  window.claude = { use: async (name) => ({ db, assets, user })[name] || null };
})();
