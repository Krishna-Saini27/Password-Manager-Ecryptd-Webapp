// IndexedDB utilities

const DB = (() => {
  const DB_NAME = "pm-v1";
  const DB_VERSION = 1;
  const ENTRIES = "entries";
  const SETTINGS = "settings";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ENTRIES)) {
          db.createObjectStore(ENTRIES, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getSetting(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS, "readonly");
      const store = tx.objectStore(SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async function setSetting(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS, "readwrite");
      const store = tx.objectStore(SETTINGS);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function addEntry(entry) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ENTRIES, "readwrite");
      const store = tx.objectStore(ENTRIES);
      const req = store.add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAllEntries() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ENTRIES, "readonly");
      const store = tx.objectStore(ENTRIES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteEntry(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ENTRIES, "readwrite");
      const store = tx.objectStore(ENTRIES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clearStore(storeName) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function bulkAddEntries(entries) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ENTRIES, "readwrite");
      const store = tx.objectStore(ENTRIES);
      for (const e of entries) {
        store.add(e);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function exportAll() {
    const settings = {
      salt: await getSetting("salt"),
      ver: await getSetting("ver"),
    };
    const entries = await getAllEntries();
    return { settings, entries };
  }

  async function importAll(payload) {
    await clearStore(SETTINGS);
    await setSetting("salt", payload.settings.salt);
    await setSetting("ver", payload.settings.ver);
    await clearStore(ENTRIES);
    await bulkAddEntries(payload.entries || []);
  }

  return {
    getSetting,
    setSetting,
    addEntry,
    getAllEntries,
    deleteEntry,
    clearStore,
    bulkAddEntries,
    exportAll,
    importAll,
  };
})();


