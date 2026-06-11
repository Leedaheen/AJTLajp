/**
 * 오프라인 큐 관리 — IndexedDB 기반
 * 오프라인 중 API 요청을 큐에 저장, 온라인 복귀 시 자동 재전송
 */
const Storage = (() => {
  const DB_NAME = 'ajtl-offline';
  const DB_VER = 1;
  const STORE = 'queue';
  let _db = null;

  async function _open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = () => reject(req.error);
    });
  }

  // 오프라인 큐에 요청 추가
  async function enqueue(method, url, body) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ method, url, body, ts: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // 큐 전체 조회
  async function getAll() {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  // 특정 항목 삭제
  async function remove(id) {
    const db = await _open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // 온라인 복귀 시 큐 재전송
  async function flush() {
    const items = await getAll();
    if (!items.length) return;

    let sent = 0;
    for (const item of items) {
      try {
        await Api.request(item.method, item.url, item.body);
        await remove(item.id);
        sent++;
      } catch {
        break; // 실패하면 나머지는 다음 기회에
      }
    }
    if (sent > 0) Toast.success(`오프라인 중 저장된 ${sent}건이 전송되었습니다.`);
  }

  // 온라인 이벤트에 자동 flush 연결
  function init() {
    window.addEventListener('online', () => flush());
  }

  return { enqueue, getAll, remove, flush, init };
})();
