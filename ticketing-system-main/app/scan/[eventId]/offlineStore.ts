/** IndexedDB helpers for offline check-in */

const DB_NAME = 'tickethub-scan';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('manifests')) {
        db.createObjectStore('manifests', { keyPath: 'eventId' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        const q = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        q.createIndex('eventId', 'eventId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export type OfflineTicket = {
  code: string;
  status: string;
  holderName: string | null;
  ticketType: string | null;
};

export type OfflineManifest = {
  eventId: string;
  eventTitle: string;
  downloadedAt: string;
  tickets: OfflineTicket[];
};

export async function saveManifest(manifest: OfflineManifest): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('manifests', 'readwrite');
    tx.objectStore('manifests').put(manifest);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadManifest(eventId: string): Promise<OfflineManifest | null> {
  const db = await openDb();
  const result = await new Promise<OfflineManifest | null>((resolve, reject) => {
    const tx = db.transaction('manifests', 'readonly');
    const req = tx.objectStore('manifests').get(eventId);
    req.onsuccess = () => resolve((req.result as OfflineManifest) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

/** Mark ticket used locally. Returns null if code not in pack. */
export async function tryMarkUsed(
  eventId: string,
  code: string
): Promise<{ ticket: OfflineTicket; alreadyUsed: boolean; cancelled: boolean } | null> {
  const manifest = await loadManifest(eventId);
  if (!manifest) return null;
  const upper = code.toUpperCase();
  const ticket = manifest.tickets.find((t) => t.code === upper);
  if (!ticket) return null;
  if (ticket.status === 'cancelled') {
    return { ticket, alreadyUsed: false, cancelled: true };
  }
  if (ticket.status === 'used') {
    return { ticket, alreadyUsed: true, cancelled: false };
  }
  ticket.status = 'used';
  await saveManifest(manifest);
  return { ticket, alreadyUsed: false, cancelled: false };
}

export async function enqueueCheckin(eventId: string, ticketCode: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({
      eventId,
      ticketCode: ticketCode.toUpperCase(),
      queuedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listQueue(eventId: string): Promise<Array<{ id: number; ticketCode: string }>> {
  const db = await openDb();
  const rows = await new Promise<Array<{ id: number; ticketCode: string }>>((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly');
    const idx = tx.objectStore('queue').index('eventId');
    const req = idx.getAll(eventId);
    req.onsuccess = () => {
      const all = (req.result || []) as Array<{ id: number; ticketCode: string }>;
      resolve(all.map((r) => ({ id: r.id, ticketCode: r.ticketCode })));
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}