// Minimal IndexedDB key-value store for local-first scene saves (no hosted database).
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('boliverse', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest) => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction('kv', mode).objectStore('kv'))
    r.onsuccess = () => resolve(r.result as T)
    r.onerror = () => reject(r.error)
  })
}

export const idbGet = <T>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key))
export const idbSet = (key: string, value: unknown) => tx<void>('readwrite', (s) => s.put(value, key))
