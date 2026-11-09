export type CpuBattleRecord = {
  result: 'win' | 'lose';
  wpm: number;
  accuracy: number;
  maxCombo: number;
  date: string;
};

const databaseName = 'type-arena-local-v1';
const databaseVersion = 1;
const recordStoreName = 'records';
const recordsKey = 'cpu-battle-records';
const legacyRecordsKey = 'type-arena-records-v1';

function isCpuBattleRecord(value: unknown): value is CpuBattleRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<CpuBattleRecord>;
  return (record.result === 'win' || record.result === 'lose')
    && typeof record.wpm === 'number'
    && typeof record.accuracy === 'number'
    && typeof record.date === 'string';
}

function parseRecords(value: unknown): CpuBattleRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCpuBattleRecord).map((record) => ({
    ...record,
    maxCombo: typeof record.maxCombo === 'number' ? record.maxCombo : 0,
  }));
}

function readLegacyRecords(): CpuBattleRecord[] {
  try {
    const stored = localStorage.getItem(legacyRecordsKey);
    return stored ? parseRecords(JSON.parse(stored) as unknown) : [];
  } catch {
    return [];
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(recordStoreName)) {
        request.result.createObjectStore(recordStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local records'));
    request.onblocked = () => reject(new Error('Local records database is blocked'));
  });
}

function readFromDatabase(database: IDBDatabase): Promise<CpuBattleRecord[] | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(recordStoreName, 'readonly');
    const request = transaction.objectStore(recordStoreName).get(recordsKey);
    request.onsuccess = () => resolve(request.result === undefined ? null : parseRecords(request.result));
    request.onerror = () => reject(request.error ?? new Error('Could not read local records'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not read local records'));
  });
}

function writeToDatabase(database: IDBDatabase, records: CpuBattleRecord[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(recordStoreName, 'readwrite');
    transaction.objectStore(recordStoreName).put(records, recordsKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local records'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save local records'));
  });
}

export async function readCpuBattleRecords(): Promise<CpuBattleRecord[]> {
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    const saved = await readFromDatabase(database);
    if (saved !== null) return saved;

    const legacy = readLegacyRecords();
    if (legacy.length > 0) await writeToDatabase(database, legacy.slice(0, 30));
    return legacy.slice(0, 30);
  } catch {
    return readLegacyRecords();
  } finally {
    database?.close();
  }
}

export async function appendCpuBattleRecord(record: CpuBattleRecord): Promise<CpuBattleRecord[]> {
  const next = [record, ...(await readCpuBattleRecords())].slice(0, 30);
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await writeToDatabase(database, next);
  } catch {
    try { localStorage.setItem(legacyRecordsKey, JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
  } finally {
    database?.close();
  }
  return next;
}

export async function clearCpuBattleRecords(): Promise<void> {
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await writeToDatabase(database, []);
  } catch {
    // Keep the legacy fallback usable in browsers that disable IndexedDB.
  } finally {
    database?.close();
  }
  try { localStorage.removeItem(legacyRecordsKey); } catch { /* Storage may be disabled. */ }
}
