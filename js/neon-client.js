let dbMode = 'local';
let remoteSaveQueue = Promise.resolve();

function showDataStatus(message, type = 'info') {
  let target = document.getElementById('data-status-message');
  if (!target) {
    target = document.createElement('div');
    target.id = 'data-status-message';
    target.className = 'data-status-message';
    document.body.appendChild(target);
  }
  target.textContent = message;
  target.dataset.type = type;
  target.classList.add('visible');
  window.clearTimeout(window.dataStatusTimer);
  window.dataStatusTimer = window.setTimeout(() => target.classList.remove('visible'), 4000);
}

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
      showDataStatus('서버 저장에 실패했습니다. 연결을 확인한 뒤 다시 시도해 주세요.', 'error');
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
    showDataStatus('서버 데이터를 불러오지 못해 현재 기기의 임시 데이터를 표시합니다.', 'error');
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
    const [projects, approvals, notices, diaries, attendance, timesheets] = await Promise.all(
      ['projects', 'approvals', 'notices', 'diaries', 'attendance', 'timesheets'].map(loadWorkflowResource)
    );
    MOCK_DB.projects = projects.map(item => ({ id: item.id, name: item.name, role: item.work_role || '', active: item.is_active }));
    MOCK_DB.approvals = approvals.map(item => ({ id: item.id, type: item.document_type, title: item.title, drafter: item.requester_id, date: String(item.created_at).slice(0, 10), status: item.status, content: item.content }));
    MOCK_DB.notices = notices.map(item => ({ id: item.id, title: item.title, category: item.category, date: String(item.created_at).slice(0, 10), content: item.content }));
    MOCK_DB.diaries = diaries.map(item => ({ id: item.id, date: String(item.work_date).slice(0, 10), projectId: item.project_id, hours: Number(item.hours), content: item.content }));
    const userId = MOCK_DB.currentUser.id;
    const monthEntries = {};
    timesheets.forEach(item => {
      const date = String(item.work_date).slice(0, 10);
      const day = Number(date.slice(-2)) - 1;
      if (day < 0 || day > 30) return;
      const key = item.entry_type === 'vacation' ? 'vacation' : item.project_id;
      if (!key) return;
      if (!monthEntries[key]) monthEntries[key] = new Array(30).fill(0);
      monthEntries[key][day] = Number(item.hours);
    });
    if (Object.keys(monthEntries).length) MOCK_DB.timesheets[userId] = monthEntries;
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
