
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
    // 하나의 보조 데이터 요청이 실패해도 프로젝트 등 나머지 화면 데이터까지 비우지 않는다.
    const resourceNames = ['projects', 'approvals', 'notices', 'diaries', 'attendance', 'timesheets', 'projectAssignments', 'wbs', 'manpower'];
    const results = await Promise.allSettled([
      ...resourceNames.map(loadWorkflowResource),
      fetch('/api/directory', { cache: 'no-store' }).then(response => response.ok ? response.json() : { users: [] })
    ]);
    const failedResources = results
      .slice(0, resourceNames.length)
      .map((result, index) => result.status === 'rejected' ? resourceNames[index] : null)
      .filter(Boolean);
    const records = index => results[index].status === 'fulfilled' ? results[index].value : [];
    const projects = records(0);
    const approvals = records(1);
    const notices = records(2);
    const diaries = records(3);
    const attendance = records(4);
    const timesheets = records(5);
    const assignments = records(6);
    const wbs = records(7);
    const manpower = records(8);
    const directory = results[9].status === 'fulfilled' ? results[9].value : { users: [] };
    MOCK_DB.projects = projects.map(item => ({ id: item.id, name: item.name, role: item.work_role || '', active: item.is_active, startedOn: item.started_on ? String(item.started_on).slice(0, 10) : '', endedOn: item.ended_on ? String(item.ended_on).slice(0, 10) : '', plannedMm: Number(item.planned_mm || 0), cost: Number(item.contract_amount || 0), clientName: item.client_name || '', code: item.project_code || '' }));
    MOCK_DB.assignedProjects = assignments.map(item => ({ projectId: item.project_id, plannedMm: Number(item.planned_mm || 0), startedOn: String(item.started_on || '1900-01-01').slice(0, 10), endedOn: item.ended_on ? String(item.ended_on).slice(0, 10) : '' }));
    MOCK_DB.wbsTasks = wbs.map(item => ({ id: item.id, projectId: item.project_id, category: item.category || '', title: item.title, startedOn: String(item.started_on).slice(0, 10), endedOn: String(item.ended_on).slice(0, 10), status: item.status || 'planned', note: item.note || '' }));
    MOCK_DB.projectsSummary = MOCK_DB.projects.map(project => ({
      name: project.name,
      pm: MOCK_DB.currentUser.name,
      status: project.active ? '진행 중' : '대기 중',
      mm: '0.0 M/M',
      state: project.active ? 'active' : 'pending'
    }));
    const directoryById = new Map((directory.users || []).map(item => [item.id, item]));
    MOCK_DB.approvals = approvals.map(item => ({ id: item.id, type: item.document_type, title: item.title, drafter: directoryById.get(item.requester_id)?.name || item.requester_id, date: String(item.created_at).slice(0, 10), status: item.status, content: item.content }));
    MOCK_DB.notices = notices.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      date: String(item.created_at).slice(0, 10),
      content: item.content,
      popupEnabled: Boolean(item.popup_enabled),
      popupStart: item.popup_start ? String(item.popup_start).slice(0, 10) : '',
      popupEnd: item.popup_end ? String(item.popup_end).slice(0, 10) : ''
    }));
    MOCK_DB.diaries = diaries.map(item => ({ id: item.id, userId: item.user_id, authorName: directoryById.get(item.user_id)?.name || item.user_id, attachmentCount: Number(item.attachment_count || 0), date: String(item.work_date).slice(0, 10), projectId: item.project_id, hours: Number(item.hours), content: item.content }));
    MOCK_DB.timesheetRecords = timesheets.map(item => ({
      workDate: String(item.work_date).slice(0, 10),
      hours: Number(item.hours || 0),
      entryType: item.entry_type || 'project',
      projectId: item.project_id || null
    }));
    MOCK_DB.manpowerRecords = manpower.map(item => ({ userId: item.user_id, projectId: item.project_id, workDate: String(item.work_date).slice(0, 10), hours: Number(item.hours || 0), entryType: item.entry_type || 'project' }));
    MOCK_DB.attendance.records = attendance.map(item => ({
      workDate: String(item.work_date).slice(0, 10),
      checkedInAt: item.checked_in_at || null,
      checkedOutAt: item.checked_out_at || null
    }));
    // 실제 월별 배열 구성은 현재 선택 월을 기준으로 renderTimesheet에서 처리한다.
    // 여기서 모든 월을 일자(1~31)만으로 합치면 7월 31일이 8월 31일에 섞일 수 있다.
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
    // 로그인 직후에는 현재 노출 기간의 팝업 공지를 한 번 안내한다.
    if (typeof renderNoticeNotifications === 'function') setTimeout(() => renderNoticeNotifications(true), 0);
    if (failedResources.length) console.info('Some workflow resources could not be loaded:', failedResources);
    return true;
  } catch (error) {
    console.info('Workflow data hydration skipped.', error);
    return false;
  }
}
