let database;

function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("dijital-caki-ev", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("records", { keyPath: "id" });
      store.createIndex("tool", "tool");
      store.createIndex("dedupe", "uniqueKey", { unique: true });
      request.result.createObjectStore("attachments");
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

async function transaction(stores, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const request = operation(tx);
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(request.error ?? tx.error);
  });
}

export const listRecords = tool => transaction("records", "readonly", tx =>
  tx.objectStore("records").index("tool").getAll(tool));
export const getAttachment = id => transaction("attachments", "readonly", tx =>
  tx.objectStore("attachments").get(id));

export function putRecord(record, bytes) {
  return transaction(["records", "attachments"], "readwrite", tx => {
    const attachments = tx.objectStore("attachments");
    if (bytes) attachments.put(bytes, record.id);
    else if (!record.attachment) attachments.delete(record.id);
    return tx.objectStore("records").put(record);
  });
}

export function deleteRecord(id) {
  return transaction(["records", "attachments"], "readwrite", tx => {
    tx.objectStore("attachments").delete(id);
    return tx.objectStore("records").delete(id);
  });
}
