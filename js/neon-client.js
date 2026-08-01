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

async function loadWorkflowResource(resource) {
  const response = await fetch(`/api/intranet-data?resource=${resource}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${resource} load failed`);
  return (await response.json()).records || [];
}

async function hydrateWorkflowsFromNeon() {
  try {
    const [projects, approvals, notices, diaries, attendance] = await Promise.all(
      ['projects', 'approvals', 'notices', 'diaries', 'attendance'].map(loadWorkflowResource)
    );
    MOCK_DB.projects = projects.map(item => ({ id: item.id, name: item.name, role: item.work_role || '', active: item.is_active }));
    MOCK_DB.approvals = approvals.map(item => ({ id: item.id, type: item.document_type, title: item.title, drafter: item.requester_id, date: String(item.created_at).slice(0, 10), status: item.status, content: item.content }));
    MOCK_DB.notices = notices.map(item => ({ id: item.id, title: item.title, category: item.category, date: String(item.created_at).slice(0, 10), content: item.content }));
    MOCK_DB.diaries = diaries.map(item => ({ id: item.id, date: String(item.work_date).slice(0, 10), projectId: item.project_id, hours: Number(item.hours), content: item.content }));
    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = attendance.find(item => String(item.work_date).slice(0, 10) === today);
    if (todayAttendance) {
      MOCK_DB.attendance.status = todayAttendance.checked_out_at ? 'out' : 'in';
      MOCK_DB.attendance.checkInTime = todayAttendance.checked_in_at ? new Date(todayAttendance.checked_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
      MOCK_DB.attendance.checkOutTime = todayAttendance.checked_out_at ? new Date(todayAttendance.checked_out_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
    }
    return true;
  } catch (error) {
    console.info('Workflow data hydration skipped.', error);
    return false;
  }
}
