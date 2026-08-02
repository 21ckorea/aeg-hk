
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

async function verifyDatabaseHealth() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('Database unavailable');
    return true;
  } catch {
    showDataStatus('데이터베이스 연결을 확인할 수 없습니다. 저장 기능을 다시 시도해 주세요.', 'error');
    return false;
  }
}

async function runWithButtonLock(button, task) {
  if (!button || button.disabled) return;
  const label = button.textContent;
  button.disabled = true;
  button.dataset.loading = 'true';
  button.textContent = '처리 중…';
  try { return await task(); }
  finally {
    button.disabled = false;
    delete button.dataset.loading;
    button.textContent = label;
  }
}


async function loadWorkflowResource(resource) {
  const response = await fetch(`/api/intranet-data?resource=${resource}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${resource} load failed`);
  return (await response.json()).records || [];
}

async function hydrateWorkflowsFromNeon() {
  try {
    const [projects, approvals, notices, diaries, attendance, timesheets, directory] = await Promise.all([
      ...['projects', 'approvals', 'notices', 'diaries', 'attendance', 'timesheets'].map(loadWorkflowResource),
      fetch('/api/directory', { cache: 'no-store' }).then(response => response.ok ? response.json() : { users: [] })
    ]
    );
    MOCK_DB.projects = projects.map(item => ({ id: item.id, name: item.name, role: item.work_role || '', active: item.is_active }));
    MOCK_DB.projectsSummary = MOCK_DB.projects.map(project => ({
      name: project.name,
      pm: MOCK_DB.currentUser.name,
      status: project.active ? '진행 중' : '대기 중',
      mm: '0.0 M/M',
      state: project.active ? 'active' : 'pending'
    }));
    const directoryById = new Map((directory.users || []).map(item => [item.id, item]));
    MOCK_DB.approvals = approvals.map(item => ({ id: item.id, type: item.document_type, title: item.title, drafter: directoryById.get(item.requester_id)?.name || item.requester_id, date: String(item.created_at).slice(0, 10), status: item.status, content: item.content }));
    MOCK_DB.notices = notices.map(item => ({ id: item.id, title: item.title, category: item.category, date: String(item.created_at).slice(0, 10), content: item.content }));
    MOCK_DB.diaries = diaries.map(item => ({ id: item.id, userId: item.user_id, attachmentCount: Number(item.attachment_count || 0), date: String(item.work_date).slice(0, 10), projectId: item.project_id, hours: Number(item.hours), content: item.content }));
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
    if (directory.users?.length) {
      MOCK_DB.employees = directory.users.map(item => ({
        id: item.id,
        name: item.name,
        dept: item.job_title || '',
        rank: item.job_rank || '',
        status: 'normal',
        avatar: item.avatar_url || item.name.charAt(0),
        joinDate: ''
      }));
    }
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
