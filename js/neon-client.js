let dbMode = 'local';
let remoteSaveQueue = Promise.resolve();

async function loadStateFromRemote() {
  const response = await fetch('/api/app-state', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Database load failed (${response.status})`);
  const data = await response.json();
  dbMode = 'remote';
  return data.payload || null;
}

function saveStateToRemote() {
  // Preserve write order so rapid UI changes cannot overwrite newer state.
  const payload = JSON.stringify(MOCK_DB);
  remoteSaveQueue = remoteSaveQueue
    .catch(() => undefined)
    .then(async () => {
      const response = await fetch('/api/app-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: JSON.parse(payload) })
      });
      if (!response.ok) throw new Error(`Database save failed (${response.status})`);
      return response.json();
    })
    .catch((error) => {
      console.warn('Neon remote save failed; local storage remains available.', error);
      dbMode = 'local';
      return null;
    });
  return remoteSaveQueue;
}

async function hydrateFromRemoteIfAvailable() {
  try {
    const remoteState = await loadStateFromRemote();
    if (!remoteState) return false;
    MOCK_DB = normalizeAppState(remoteState);
    ensureStateShape();
    saveAppState();
    return true;
  } catch (error) {
    console.info('Neon database is unavailable; using local storage.', error);
    dbMode = 'local';
    return false;
  }
}
