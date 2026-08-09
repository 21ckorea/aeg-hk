
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

function workflowCacheKey() {
  return `intranet-workflow-cache:${MOCK_DB.currentUser.id || 'anonymous'}`;
}

function readWorkflowCache() {
  try {
    const cached = sessionStorage.getItem(workflowCacheKey());
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function saveWorkflowCache(records) {
  try {
    sessionStorage.setItem(workflowCacheKey(), JSON.stringify(records));
  } catch {
    // 브라우저 저장소를 사용할 수 없어도 API 데이터 조회 자체에는 영향이 없다.
  }
}

async function loadLegacyWorkflowBootstrap() {
  const resourceNames = ['projects', 'approvals', 'notices', 'diaries', 'attendance', 'timesheets', 'projectAssignments', 'wbs', 'manpower', 'timesheetClosures'];
  const values = await Promise.all(resourceNames.map(loadWorkflowResource));
  const directoryResponse = await fetch('/api/directory', { cache: 'no-store' });
  if (!directoryResponse.ok) throw new Error('directory load failed');
  const directory = await directoryResponse.json();
  return Object.fromEntries(resourceNames.map((resource, index) => [resource, values[index]]).concat([['users', directory.users || []]]));
}

async function loadWorkflowBootstrap() {
  try {
    const response = await fetch('/api/intranet-data?resource=bootstrap', { cache: 'no-store' });
    if (!response.ok) throw new Error(`bootstrap load failed (${response.status})`);
    const payload = await response.json();
    if (!payload.records || typeof payload.records !== 'object') throw new Error('bootstrap response is invalid');
    return payload.records;
  } catch (bootstrapError) {
    // 운영 API가 새 버전으로 배포되기 전인 로컬 개발 환경도 안전하게 지원한다.
    return loadLegacyWorkflowBootstrap();
  }
}

async function hydrateWorkflowsFromNeon() {
  try {
    // 응답 전체를 받은 뒤에만 화면 상태를 교체한다. 중간 요청 실패로 기존 데이터를
    // 빈 배열로 덮어쓰지 않으며, 같은 탭에서는 마지막 정상 조회 결과도 보존한다.
    let snapshot;
    try {
      snapshot = await loadWorkflowBootstrap();
      saveWorkflowCache(snapshot);
    } catch (error) {
      snapshot = readWorkflowCache();
      if (!snapshot) throw error;
      showDataStatus('서버 응답이 지연되어 마지막으로 정상 조회한 데이터를 표시합니다. 잠시 후 새로고침해 주세요.', 'error');
    }
    const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
    const approvals = Array.isArray(snapshot.approvals) ? snapshot.approvals : [];
    const notices = Array.isArray(snapshot.notices) ? snapshot.notices : [];
    const diaries = Array.isArray(snapshot.diaries) ? snapshot.diaries : [];
    const attendance = Array.isArray(snapshot.attendance) ? snapshot.attendance : [];
    const timesheets = Array.isArray(snapshot.timesheets) ? snapshot.timesheets : [];
    const assignments = Array.isArray(snapshot.projectAssignments) ? snapshot.projectAssignments : [];
    const wbs = Array.isArray(snapshot.wbs) ? snapshot.wbs : [];
    const manpower = Array.isArray(snapshot.manpower) ? snapshot.manpower : [];
    const timesheetClosures = Array.isArray(snapshot.timesheetClosures) ? snapshot.timesheetClosures : [];
    const directory = { users: Array.isArray(snapshot.users) ? snapshot.users : [] };
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
    MOCK_DB.timesheetClosures = timesheetClosures.map(item => ({ yearMonth: String(item.year_month).slice(0, 7), locked: Boolean(item.is_locked) }));
    MOCK_DB.attendance.records = attendance.map(item => ({
      workDate: String(item.work_date).slice(0, 10),
      checkedInAt: item.checked_in_at || null,
      checkedOutAt: item.checked_out_at || null
    }));
    // 실제 월별 배열 구성은 현재 선택 월을 기준으로 renderTimesheet에서 처리한다.
    // 여기서 모든 월을 일자(1~31)만으로 합치면 7월 31일이 8월 31일에 섞일 수 있다.
    const loadedEmployees = (directory.users || []).map(item => ({
        id: item.id,
        name: item.name,
        dept: item.job_title || '',
        rank: item.job_rank || '',
        status: 'normal',
        avatar: item.avatar_url || item.name.charAt(0),
        joinDate: ''
      }));
    // 디렉터리 조회가 잠시 실패해도 가상의 직원 대신 현재 로그인한 사용자만 표시한다.
    MOCK_DB.employees = loadedEmployees.length ? loadedEmployees : [{
      id: MOCK_DB.currentUser.id,
      name: MOCK_DB.currentUser.name,
      dept: MOCK_DB.currentUser.role || '',
      rank: '',
      status: 'normal',
      avatar: MOCK_DB.currentUser.avatar || MOCK_DB.currentUser.name.charAt(0),
      joinDate: ''
    }].filter(item => item.id);
    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = attendance.find(item => String(item.work_date).slice(0, 10) === today);
    if (todayAttendance) {
      MOCK_DB.attendance.status = todayAttendance.checked_out_at ? 'out' : 'in';
      MOCK_DB.attendance.checkInTime = todayAttendance.checked_in_at ? new Date(todayAttendance.checked_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
      MOCK_DB.attendance.checkOutTime = todayAttendance.checked_out_at ? new Date(todayAttendance.checked_out_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
    }
    // 로그인 직후에는 현재 노출 기간의 팝업 공지를 한 번 안내한다.
    if (typeof renderNoticeNotifications === 'function') setTimeout(() => renderNoticeNotifications(true), 0);
    return true;
  } catch (error) {
    console.info('Workflow data hydration skipped.', error);
    return false;
  }
}
