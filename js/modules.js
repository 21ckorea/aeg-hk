function getTimesheetMonth() {
  return document.getElementById('ts-year-month')?.value || new Date().toISOString().slice(0, 7);
}

function getTimesheetDays() {
  const [year, month] = getTimesheetMonth().split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

const KOREAN_HOLIDAYS = new Set([
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02',
  '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-06', '2026-08-15', '2026-08-17',
  '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25'
]);

function getTimesheetDayClass(dayNumber) {
  const [year, month] = getTimesheetMonth().split('-').map(Number);
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
  const weekDay = new Date(year, month - 1, dayNumber).getDay();
  if (KOREAN_HOLIDAYS.has(dateKey) || weekDay === 0) return 'holiday-red';
  if (weekDay === 6) return 'saturday-blue';
  return '';
}

function populateTimesheetMonths() {
  const select = document.getElementById('ts-year-month');
  if (!select || select.options.length) return;
  const now = new Date();
  for (let offset = 0; offset >= -11; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    select.add(new Option(`${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`, value));
  }
}

function initTimesheets() {
  populateTimesheetMonths();
  const daysInMonth = getTimesheetDays();
  ensureStateShape();

  MOCK_DB.employees.forEach(emp => {
    if (!MOCK_DB.timesheets[emp.id]) {
      MOCK_DB.timesheets[emp.id] = {};
    }

    MOCK_DB.projects.forEach(p => {
      if (!MOCK_DB.timesheets[emp.id][p.id]) {
        MOCK_DB.timesheets[emp.id][p.id] = new Array(daysInMonth).fill(0);
      }
      while (MOCK_DB.timesheets[emp.id][p.id].length < daysInMonth) MOCK_DB.timesheets[emp.id][p.id].push(0);
    });

    if (!MOCK_DB.timesheets[emp.id]['vacation']) {
      MOCK_DB.timesheets[emp.id]['vacation'] = new Array(daysInMonth).fill(0);
    }
    while (MOCK_DB.timesheets[emp.id].vacation.length < daysInMonth) MOCK_DB.timesheets[emp.id].vacation.push(0);
  });

  saveAppState();
}

function renderTimesheet() {
  const table = document.getElementById('timesheet-grid-table');
  if (!table) return;

  const daysInMonth = getTimesheetDays();
  const activeUserId = MOCK_DB.currentUser.id;
  const ts = MOCK_DB.timesheets[activeUserId] || {};
  initTimesheets();

  let headHtml = `
    <thead>
      <tr>
        <th rowspan="2">프로젝트 / 과업명</th>
        <th colspan="${daysInMonth}">일자별 투입시간</th>
        <th rowspan="2">누적합계</th>
        <th rowspan="2">계산 M/M</th>
      </tr>
      <tr>
  `;
  for (let d = 1; d <= daysInMonth; d++) {
    headHtml += `<th class="day-col day-header ${getTimesheetDayClass(d)}">${d}</th>`;
  }
  headHtml += `</tr></thead>`;

  let bodyHtml = '<tbody>';
  let activeProjects = MOCK_DB.projects.filter(p => p.active);

  if (activeProjects.length === 0) {
    bodyHtml += `<tr><td colspan="${daysInMonth + 3}" style="text-align:center; padding:28px; color:var(--text-muted);">프로젝트가 아직 없습니다. 아래에서 새 프로젝트를 등록해 주세요.</td></tr>`;
  } else {
    activeProjects.forEach(p => {
      bodyHtml += '<tr>';
      bodyHtml += `<td><strong>${p.name}</strong><br><span style="font-size:10px; color:#64748b;">${p.role}</span></td>`;

      let projTotal = 0;
      for (let d = 0; d < daysInMonth; d++) {
        const dateClass = getTimesheetDayClass(d + 1);
        const val = ts[p.id]?.[d] || 0;
        projTotal += val;
        bodyHtml += `
          <td class="day-cell ${dateClass}">
            <input type="number" min="0" max="8" value="${val}" class="input-cell"
                   onchange="updateCellHours('${activeUserId}', '${p.id}', ${d}, this.value)">
          </td>
        `;
      }

      const calculatedMM = (projTotal / 176).toFixed(3);
      bodyHtml += `<td class="summary-col" id="total-${p.id}">${projTotal}H</td>`;
      bodyHtml += `<td class="summary-col text-blue" id="mm-${p.id}">${calculatedMM} M/M</td>`;
      bodyHtml += '</tr>';
    });
  }

  bodyHtml += '<tr>';
  bodyHtml += '<td><strong>개인휴가 행</strong><br><span style="font-size:10px; color:#64748b;">연차/반차 반출</span></td>';
  let vacTotal = 0;
  for (let d = 0; d < daysInMonth; d++) {
    const dateClass = getTimesheetDayClass(d + 1);
    const val = ts['vacation']?.[d] || 0;
    vacTotal += val;
    bodyHtml += `
      <td class="day-cell ${dateClass}">
        <input type="number" min="0" max="8" step="4" value="${val}" class="input-cell" style="color:var(--primary); font-weight:700;"
               onchange="updateCellHours('${activeUserId}', 'vacation', ${d}, this.value)">
      </td>
    `;
  }
  bodyHtml += `<td class="summary-col" id="total-vacation">${vacTotal}H</td>`;
  bodyHtml += '<td class="summary-col text-blue">-</td>';
  bodyHtml += '</tr>';

  bodyHtml += '<tr class="day-total-row">';
  bodyHtml += '<td><strong>일별 합산 (최대 8H)</strong></td>';
  for (let d = 0; d < daysInMonth; d++) {
    const dayTotal = getDayTotal(activeUserId, d);
    const isExceeded = dayTotal > 8;
    bodyHtml += `<td class="${isExceeded ? 'exceeded' : 'valid'}" id="daytotal-${d}">${dayTotal}</td>`;
  }
  bodyHtml += '<td class="summary-col" id="ts-grid-grand-total">0H</td>';
  bodyHtml += '<td class="summary-col" id="ts-grid-grand-mm">0.000 M/M</td>';
  bodyHtml += '</tr></tbody>';

  table.innerHTML = headHtml + bodyHtml;

  updateTimesheetSummaries();
}

function getDayTotal(empId, dayIdx) {
  const ts = MOCK_DB.timesheets[empId];
  let total = 0;

  MOCK_DB.projects.forEach(p => {
    if (ts[p.id]) total += ts[p.id][dayIdx] || 0;
  });
  if (ts['vacation']) total += ts['vacation'][dayIdx] || 0;

  return total;
}

function updateCellHours(empId, projId, dayIdx, value) {
  const parsedVal = Math.max(0, Math.min(8, parseInt(value) || 0));
  MOCK_DB.timesheets[empId][projId][dayIdx] = parsedVal;

  let projTotal = 0;
  const daysInMonth = getTimesheetDays();
  for (let d = 0; d < daysInMonth; d++) {
    projTotal += MOCK_DB.timesheets[empId][projId][d] || 0;
  }

  const totalCell = document.getElementById(`total-${projId}`);
  if (totalCell) totalCell.textContent = `${projTotal}H`;

  const mmCell = document.getElementById(`mm-${projId}`);
  if (mmCell && projId !== 'vacation') {
    mmCell.textContent = `${(projTotal / 176).toFixed(3)} M/M`;
  }

  const dayTotal = getDayTotal(empId, dayIdx);
  const dayTotalCell = document.getElementById(`daytotal-${dayIdx}`);
  if (dayTotalCell) {
    dayTotalCell.textContent = dayTotal;
    dayTotalCell.className = dayTotal > 8 ? 'exceeded' : 'valid';
  }

  updateTimesheetSummaries();
}

function updateTimesheetSummaries() {
  const daysInMonth = getTimesheetDays();
  let grandTotal = 0;

  for (let d = 0; d < daysInMonth; d++) {
    grandTotal += getDayTotal(MOCK_DB.currentUser.id, d);
  }

  const targetDisplay = document.getElementById('ts-total-input-hours');
  if (targetDisplay) {
    targetDisplay.textContent = `${grandTotal}H`;
    if (grandTotal > 176) {
      targetDisplay.style.color = 'var(--accent-red)';
      targetDisplay.style.fontWeight = '800';
    } else {
      targetDisplay.style.color = 'var(--text-dark)';
      targetDisplay.style.fontWeight = '700';
    }
  }

  const gridGrand = document.getElementById('ts-grid-grand-total');
  if (gridGrand) {
    gridGrand.textContent = `${grandTotal}H`;
    if (grandTotal > 176) {
      gridGrand.style.backgroundColor = '#fee2e2';
      gridGrand.style.color = 'var(--accent-red)';
    } else {
      gridGrand.style.backgroundColor = 'transparent';
      gridGrand.style.color = 'var(--text-dark)';
    }
  }

  const gridGrandMM = document.getElementById('ts-grid-grand-mm');
  if (gridGrandMM) {
    const mm = (grandTotal / 176).toFixed(3);
    gridGrandMM.textContent = `${mm} M/M`;
    if (grandTotal > 176) {
      gridGrandMM.style.backgroundColor = '#fee2e2';
      gridGrandMM.style.color = 'var(--accent-red)';
    } else {
      gridGrandMM.style.backgroundColor = 'transparent';
      gridGrandMM.style.color = 'var(--text-dark)';
    }
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function addProjectRowPopup() {
  const modal = document.getElementById('modal-add-project');
  modal.classList.add('active');

  const listContainer = document.getElementById('modal-project-choices');
  listContainer.innerHTML = '';

  const inactiveProjects = MOCK_DB.projects.filter(p => !p.active);
  if (inactiveProjects.length === 0) {
    closeModal('modal-add-project');
    createProjectFromPrompt();
    return;
  }

  inactiveProjects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'project-choice-item';
    item.onclick = () => activateProjectRow(p.id);
    item.innerHTML = `
      <div>
        <h5>${p.name}</h5>
        <span class="role">배정역할: AA기획설계</span>
      </div>
      <button class="btn-sm-action approve"><i data-lucide="plus"></i> 추가</button>
    `;
    listContainer.appendChild(item);
  });

  lucide.createIcons();
}

async function createProjectFromPrompt() {
  const name = window.prompt('새 프로젝트명을 입력해 주세요.', '신규 프로젝트');
  if (!name) return;

  const role = window.prompt('담당 역할을 입력해 주세요.', '설계지원');
  const response = await fetch('/api/intranet-data?resource=projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), workRole: role?.trim() || '설계지원' }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '프로젝트 등록에 실패했습니다.');
  const newProject = {
    id: result.record.id,
    name: name.trim(),
    role: role?.trim() || '설계지원',
    active: true
  };

  MOCK_DB.projects.push(newProject);
  MOCK_DB.projectsSummary.push({
    name: newProject.name,
    pm: MOCK_DB.currentUser.name,
    status: '진행 중',
    mm: '0.0 M/M',
    state: 'active'
  });
  initTimesheets();
  saveAppState();
  renderTimesheet();
  renderDashboardProjects();
  closeModal('modal-add-project');
}

function activateProjectRow(projId) {
  const proj = MOCK_DB.projects.find(p => p.id === projId);
  if (proj) {
    proj.active = true;
    closeModal('modal-add-project');
    initTimesheets();
    saveAppState();
    renderTimesheet();
  }
}

async function saveTimesheet() {
  const current = MOCK_DB.timesheets[MOCK_DB.currentUser.id] || MOCK_DB.timesheets.emp01 || {};
  const requests = [];
  const month = getTimesheetMonth();
  Object.entries(current).forEach(([projectId, hours]) => hours.forEach((value, day) => {
    if (Number(value) > 0) requests.push(fetch('/api/intranet-data?resource=timesheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId === 'vacation' ? null : projectId, entryType: projectId === 'vacation' ? 'vacation' : 'project', workDate: `${month}-${String(day + 1).padStart(2, '0')}`, hours: Number(value) }) }));
  }));
  const results = await Promise.all(requests);
  if (results.some(response => !response.ok)) return alert('일부 타임시트 저장에 실패했습니다.');
  saveAppState();
  alert('타임시트가 Neon DB에 저장되었습니다.');
}

function submitTimesheet() {
  let errorFound = false;
  for (let d = 0; d < 30; d++) {
    if (getDayTotal('emp01', d) > 8) {
      errorFound = true;
      break;
    }
  }

  let grandTotal = 0;
  for (let d = 0; d < 30; d++) {
    grandTotal += getDayTotal('emp01', d);
  }

  saveAppState();

  if (errorFound) {
    alert('⚠️ 입력오류: 하루 최대 8시간을 초과하여 배분된 날짜가 있습니다. 수정 후 제출해주세요.');
  } else if (grandTotal > 176) {
    alert(`⚠️ 입력오류: 1달 총 투입시간 합계가 1 M/M (176시간)을 초과할 수 없습니다. 현재 투입합계: ${grandTotal}H (${(grandTotal / 176).toFixed(3)} M/M)`);
  } else {
    alert('✅ 제출성공: 타임시트가 저장되고 마감 처리되었습니다.');
  }
}

let manpowerViewMode = 'employee';
let activeEmployeeId = 'emp01';

function setManpowerViewMode(mode) {
  manpowerViewMode = mode;
  document.getElementById('btn-view-by-emp').classList.toggle('active', mode === 'employee');
  document.getElementById('btn-view-by-proj').classList.toggle('active', mode === 'project');

  renderManpowerAnalysis();
}

function renderManpowerAnalysis() {
  renderEmployeeList();
  renderEmployeeDetails(activeEmployeeId);
}

function renderEmployeeList() {
  const container = document.getElementById('manpower-employee-list');
  if (!container) return;

  container.innerHTML = '';

  MOCK_DB.employees.forEach(emp => {
    let totalHours = 0;
    const ts = MOCK_DB.timesheets[emp.id];
    Object.keys(ts).forEach(projId => {
      ts[projId].forEach(h => totalHours += h);
    });
    const totalMM = (totalHours / 176).toFixed(1);

    const item = document.createElement('div');
    item.className = `employee-item ${emp.id === activeEmployeeId ? 'active' : ''}`;
    item.onclick = () => selectEmployeeForAnalysis(emp.id);

    item.innerHTML = `
      <div class="employee-meta">
        <span class="name">${emp.name} ${emp.rank}</span>
        <span class="dept">${emp.dept} | ${totalHours}H (${totalMM} M/M)</span>
      </div>
      <span class="employee-status-badge ${emp.status}"></span>
    `;

    container.appendChild(item);
  });
}

function selectEmployeeForAnalysis(empId) {
  activeEmployeeId = empId;
  const items = document.querySelectorAll('.employee-list .employee-item');
  items.forEach(item => item.classList.remove('active'));
  renderManpowerAnalysis();
}

function filterEmployees() {
  const query = document.getElementById('emp-search').value.toLowerCase();
  const items = document.querySelectorAll('.employee-list .employee-item');

  MOCK_DB.employees.forEach((emp, index) => {
    const target = items[index];
    if (emp.name.toLowerCase().includes(query) || emp.dept.toLowerCase().includes(query)) {
      target.style.display = 'flex';
    } else {
      target.style.display = 'none';
    }
  });
}

function renderEmployeeDetails(empId) {
  const emp = MOCK_DB.employees.find(e => e.id === empId);
  const ts = MOCK_DB.timesheets[empId];
  if (!emp || !ts) return;

  document.getElementById('detail-emp-avatar').textContent = emp.avatar;
  document.getElementById('detail-emp-name').textContent = `${emp.name} ${emp.rank}`;
  document.getElementById('detail-emp-dept').textContent = `${emp.dept} | 입사일: ${emp.joinDate}`;

  const allocations = [];
  let grandTotal = 0;

  MOCK_DB.projects.forEach(p => {
    let projSum = 0;
    if (ts[p.id]) {
      ts[p.id].forEach(h => projSum += h);
    }
    if (projSum > 0) {
      allocations.push({ id: p.id, name: p.name, role: p.role, hours: projSum });
      grandTotal += projSum;
    }
  });

  const chartContainer = document.getElementById('manpower-bar-chart');
  chartContainer.innerHTML = '';

  if (allocations.length === 0) {
    chartContainer.innerHTML = '<p style="font-size:12px; color:var(--text-muted);">투입 기록이 없습니다.</p>';
  }

  allocations.forEach(alloc => {
    const percent = grandTotal > 0 ? Math.round((alloc.hours / grandTotal) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="week-lbl" title="${alloc.name}">${alloc.name}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${percent}%;"></div>
      </div>
      <span class="hours">${percent}%</span>
    `;
    chartContainer.appendChild(row);
  });

  const heatmap = document.getElementById('manpower-heatmap-grid');
  heatmap.innerHTML = '';

  const daysInMonth = 30;
  for (let d = 0; d < daysInMonth; d++) {
    const dayTotal = getDayTotal(empId, d);
    let levelClass = 'level-0';
    if (dayTotal > 0 && dayTotal <= 3) levelClass = 'level-1';
    else if (dayTotal > 3 && dayTotal <= 6) levelClass = 'level-2';
    else if (dayTotal > 6) levelClass = 'level-3';

    const cell = document.createElement('div');
    cell.className = `heatmap-cell ${levelClass}`;
    cell.textContent = dayTotal;
    cell.title = `6월 ${d + 1}일: ${dayTotal}시간 투입`;
    heatmap.appendChild(cell);
  }

  const tbody = document.querySelector('#manpower-allocation-table tbody');
  tbody.innerHTML = '';

  if (allocations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">배정 명세가 없습니다.</td></tr>';
    return;
  }

  allocations.forEach(alloc => {
    const calculatedMM = (alloc.hours / 176).toFixed(3);
    const confirmedMM = calculatedMM;
    const ratio = grandTotal > 0 ? ((alloc.hours / grandTotal) * 100).toFixed(1) : 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${alloc.name}</strong></td>
      <td>${alloc.role}</td>
      <td>${alloc.hours}H</td>
      <td>${calculatedMM} M/M</td>
      <td><input type="number" min="0" max="1" step="0.05" value="${confirmedMM}" style="width:70px; padding:3px; font-size:12px; border:1px solid var(--border-light); outline:none;"></td>
      <td class="text-blue" style="font-weight:600;">${ratio}%</td>
    `;
    tbody.appendChild(row);
  });
}

let activeApprovalTab = 'waiting';

function switchApprovalTab(tabId, event) {
  activeApprovalTab = tabId;
  const tabBtns = document.querySelectorAll('.tab-buttons .tab-btn');
  tabBtns.forEach(btn => btn.classList.remove('active'));

  if (event?.currentTarget) {
    event.currentTarget.classList.add('active');
  }
  renderApprovalsTable();
}

function renderApprovalsTable() {
  const tbody = document.getElementById('approval-list-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  let filtered = MOCK_DB.approvals;
  if (activeApprovalTab === 'waiting') {
    filtered = MOCK_DB.approvals.filter(a => a.status === 'waiting');
  } else if (activeApprovalTab === 'sent') {
    filtered = MOCK_DB.approvals.filter(a => a.drafter === MOCK_DB.currentUser.name);
  } else if (activeApprovalTab === 'completed') {
    filtered = MOCK_DB.approvals.filter(a => a.status === 'approved' || a.status === 'rejected');
  }

  const pendingCount = MOCK_DB.approvals.filter(a => a.status === 'waiting').length;
  const pendingBadge = document.getElementById('pending-approval-count');
  if (pendingBadge) pendingBadge.textContent = pendingCount;
  const dashCount = document.getElementById('dashboard-pending-approvals');
  if (dashCount) dashCount.textContent = `${pendingCount}건`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">결재 문서가 아직 없습니다. 새 문서를 작성해 주세요.</td></tr>';
    return;
  }

  filtered.forEach(ap => {
    let badgeClass = 'waiting';
    let statusText = '대기중';
    if (ap.status === 'approved') { badgeClass = 'approved'; statusText = '승인완료'; }
    else if (ap.status === 'rejected') { badgeClass = 'rejected'; statusText = '반려'; }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${ap.id}</td>
      <td><span class="badge" style="background:#e2e8f0; color:var(--text-dark);">${ap.type}</span></td>
      <td><strong>${ap.title}</strong></td>
      <td>${ap.drafter}</td>
      <td>${ap.date}</td>
      <td><span class="badge-status ${badgeClass}">${statusText}</span></td>
      <td>
        ${ap.status === 'waiting' ? `
          <button class="btn-sm-action approve" onclick="processApproval('${ap.id}', 'approved')">승인</button>
          <button class="btn-sm-action reject" onclick="processApproval('${ap.id}', 'rejected')">반려</button>
        ` : '<span style="color:var(--text-muted); font-size:11px;">처리완료</span>'}
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function processApproval(apId, action) {
  const response = await fetch('/api/intranet-data?resource=approvals', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: apId, status: action }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '결재 처리에 실패했습니다.');
  const ap = MOCK_DB.approvals.find(a => a.id === apId);
  if (ap) {
    ap.status = action;
    saveAppState();
    alert(`[결재 알림] ${ap.title} 건이 ${action === 'approved' ? '승인' : '반려'} 처리되었습니다.`);
    renderApprovalsTable();
    renderDashboardApprovals();
  }
}

function openApprovalModal() {
  document.getElementById('modal-create-approval').classList.add('active');
}

async function submitApprovalForm(e) {
  e.preventDefault();
  const type = document.getElementById('ap-type').value;
  const title = document.getElementById('ap-title').value;
  const content = document.getElementById('ap-content').value;

  const newAp = {
    id: `APP-${Date.now()}`,
    type,
    title,
    drafter: MOCK_DB.currentUser.name,
    date: new Date().toISOString().split('T')[0],
    status: 'waiting',
    content
  };

  const response = await fetch('/api/intranet-data?resource=approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentType: type, title, content }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '기안 저장에 실패했습니다.');
  newAp.id = result.record.id;
  MOCK_DB.approvals.unshift(newAp);
  saveAppState();
  closeModal('modal-create-approval');
  document.getElementById('approval-form').reset();

  alert('기안이 완료되어 상신되었습니다.');

  if (activeSubView === 'approval') renderApprovalsTable();
  renderDashboardApprovals();
}

function updateDashboardStats() {
  const todayAttendance = document.querySelector('.stat-card .num');
  const projectCount = document.querySelectorAll('.stat-card .num')[1];
  const approvalCount = document.querySelectorAll('.stat-card .num')[2];
  const diaryCount = document.querySelectorAll('.stat-card .num')[3];

  const activeProjectsCount = MOCK_DB.projects.filter(project => project.active).length;
  const pendingCount = MOCK_DB.approvals.filter(item => item.status === 'waiting').length;
  const diariesThisMonth = MOCK_DB.diaries.filter(item => item.date.startsWith('2026-06')).length;
  const checkedInCount = MOCK_DB.attendance.status === 'in' ? 1 : 0;
  const totalStaff = Math.max(MOCK_DB.employees.length, 1);

  if (todayAttendance) todayAttendance.textContent = `${checkedInCount} / ${totalStaff}`;
  if (projectCount) projectCount.textContent = `${activeProjectsCount}개`;
  if (approvalCount) approvalCount.textContent = `${pendingCount}건`;
  if (diaryCount) diaryCount.textContent = `${diariesThisMonth}개`;
}

function renderDashboardApprovals() {
  const container = document.getElementById('dashboard-approvals-container');
  if (!container) return;

  container.innerHTML = '';
  const pending = MOCK_DB.approvals.filter(a => a.status === 'waiting');

  if (pending.length === 0) {
    container.innerHTML = '<p style="padding:30px; text-align:center; font-size:13px; color:var(--text-muted);">대기 중인 결재가 없습니다.</p>';
  } else {
    pending.slice(0, 3).forEach(ap => {
      const item = document.createElement('div');
      item.className = 'approval-item';
      item.innerHTML = `
        <div class="approval-item-left">
          <span class="title">${ap.title}</span>
          <span class="meta">${ap.drafter} | ${ap.date}</span>
        </div>
        <div class="approval-item-right">
          <button class="btn-sm-action approve" onclick="processApproval('${ap.id}', 'approved')">승인</button>
          <button class="btn-sm-action reject" onclick="processApproval('${ap.id}', 'rejected')">반려</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  updateDashboardStats();
  renderDashboardProjects();
  renderDashboardNotices();
}

function renderDashboardProjects() {
  const tbody = document.querySelector('#dashboard-projects-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const projectsForDisplay = MOCK_DB.projectsSummary.length > 0
    ? MOCK_DB.projectsSummary
    : MOCK_DB.projects.map(project => ({
        name: project.name,
        pm: MOCK_DB.currentUser.name,
        status: project.active ? '진행 중' : '대기 중',
        mm: '0.0 M/M',
        state: project.active ? 'active' : 'pending'
      }));

  if (projectsForDisplay.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:24px;">등록된 프로젝트가 없습니다. 새 프로젝트를 추가해 주세요.</td></tr>';
    return;
  }

  projectsForDisplay.forEach(project => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${project.name}</strong></td>
      <td>${project.pm}</td>
      <td><span class="status-pill ${project.state === 'pending' ? 'pending' : 'active'}">${project.status}</span></td>
      <td>${project.mm}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderDashboardNotices() {
  const list = document.getElementById('dashboard-notice-list');
  if (!list) return;

  list.innerHTML = '';
  if (MOCK_DB.notices.length === 0) {
    list.innerHTML = '<li style="padding:12px 0; color:var(--text-muted);">등록된 공지사항이 없습니다. 새 공지를 추가해 주세요.</li>';
    return;
  }

  MOCK_DB.notices.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="badge-notice ${item.category === '긴급' ? 'urgent' : ''}">${item.category}</span>
      <a href="#">${item.title}</a>
      <span class="date">${item.date}</span>
    `;
    list.appendChild(li);
  });
}

function openNoticeModal() {
  document.getElementById('modal-create-notice').classList.add('active');
}

async function submitNoticeForm(e) {
  e.preventDefault();
  const title = document.getElementById('notice-title').value.trim();
  const category = document.getElementById('notice-category').value;
  const content = document.getElementById('notice-content').value.trim();

  if (!title || !content) return;

  const response = await fetch('/api/intranet-data?resource=notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, category, content }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '공지 등록에 실패했습니다.');
  MOCK_DB.notices.unshift({
    id: `N${Date.now()}`,
    title,
    category,
    date: new Date().toLocaleDateString('ko-KR').slice(5),
    content
  });
  saveAppState();
  closeModal('modal-create-notice');
  document.getElementById('notice-form').reset();
  alert('공지사항이 등록되었습니다.');
  renderDashboardApprovals();
}

async function performCheckIn() {
  const now = new Date();
  const response = await fetch('/api/intranet-data?resource=attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workDate: now.toISOString().slice(0, 10), checkedInAt: now.toISOString() }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '출근 등록에 실패했습니다.');
  MOCK_DB.attendance.status = 'in';
  MOCK_DB.attendance.checkInTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  MOCK_DB.attendance.checkOutTime = null;
  saveAppState();

  alert(`출근 등록이 완료되었습니다. (등록시간: ${MOCK_DB.attendance.checkInTime})`);

  updateAttendanceUI();
  renderDashboardApprovals();
}

async function performCheckOut() {
  const now = new Date();
  const response = await fetch('/api/intranet-data?resource=attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workDate: now.toISOString().slice(0, 10), checkedOutAt: now.toISOString() }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '퇴근 등록에 실패했습니다.');
  MOCK_DB.attendance.status = 'out';
  MOCK_DB.attendance.checkOutTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  MOCK_DB.attendance.log.push({
    date: now.toLocaleDateString('ko-KR'),
    in: MOCK_DB.attendance.checkInTime,
    out: MOCK_DB.attendance.checkOutTime
  });
  saveAppState();

  alert(`퇴근 등록이 완료되었습니다. (등록시간: ${MOCK_DB.attendance.checkOutTime})`);

  updateAttendanceUI();
  renderDashboardApprovals();
}

function updateAttendanceUI() {
  const status = MOCK_DB.attendance.status;
  const inBtn = document.getElementById('btn-quick-check-in');
  const outBtn = document.getElementById('btn-quick-check-out');
  const inBtnLarge = document.getElementById('btn-check-in-large');
  const outBtnLarge = document.getElementById('btn-check-out-large');
  const quickStatus = document.getElementById('quick-check-status');

  if (status === 'in') {
    if (quickStatus) {
      quickStatus.textContent = '출근 완료';
      quickStatus.className = 'status-badge in';
    }

    if (inBtn) inBtn.classList.add('disabled');
    if (outBtn) outBtn.classList.remove('disabled');
    if (inBtnLarge) inBtnLarge.classList.add('disabled');
    if (outBtnLarge) outBtnLarge.classList.remove('disabled');
  } else {
    if (quickStatus) {
      quickStatus.textContent = '퇴근 완료';
      quickStatus.className = 'status-badge out';
    }

    if (inBtn) inBtn.classList.remove('disabled');
    if (outBtn) outBtn.classList.add('disabled');
    if (inBtnLarge) inBtnLarge.classList.remove('disabled');
    if (outBtnLarge) outBtnLarge.classList.add('disabled');
  }

  const logContainer = document.getElementById('attendance-log-today');
  if (logContainer) {
    if (MOCK_DB.attendance.checkInTime) {
      logContainer.innerHTML = `
        <div style="font-size:13px; color:var(--text-muted); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <span>출근시간: <strong>${MOCK_DB.attendance.checkInTime}</strong></span>
          <span>퇴근시간: <strong>${MOCK_DB.attendance.checkOutTime || '--:--'}</strong></span>
        </div>
      `;
    } else {
      logContainer.innerHTML = '<span style="font-size:13px; color:var(--text-muted);">근무 등록 내역이 없습니다.</span>';
    }
  }
}

function renderAttendancePageClock() {
  updateAttendanceUI();
}

function escapeAdminHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function updateUserAccess(userId, change) {
  const response = await fetch('/api/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: userId, ...change })
  });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '권한 변경에 실패했습니다.');
  await renderAdminPanel();
}

async function renderAdminPanel() {
  const countEl = document.getElementById('admin-user-count');
  const approvalEl = document.getElementById('admin-approval-count');
  const listEl = document.getElementById('admin-user-list');

  if (!countEl || !approvalEl || !listEl) return;

  let users = [];
  try {
    const response = await fetch('/api/users', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '사용자 목록을 불러올 수 없습니다.');
    users = data.users;
  } catch (error) {
    listEl.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--accent-red);">${escapeAdminHtml(error.message)}</td></tr>`;
    return;
  }
  countEl.textContent = `${users.length}명`;
  approvalEl.textContent = `${MOCK_DB.approvals.filter(item => item.status === 'waiting').length}건`;

  listEl.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    const position = [user.job_rank, user.job_title].filter(Boolean).join(' / ') || '-';
    row.innerHTML = `
      <td>${escapeAdminHtml(user.name)}</td>
      <td>${escapeAdminHtml(user.email)}</td>
      <td>${escapeAdminHtml(position)}</td>
      <td><select aria-label="${escapeAdminHtml(user.name)} 권한 변경" onchange="updateUserAccess('${escapeAdminHtml(user.id)}', { role: this.value })">
        <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>사원</option>
        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>PM</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>관리자</option>
      </select></td>
      <td><select aria-label="${escapeAdminHtml(user.name)} 계정 상태 변경" onchange="updateUserAccess('${escapeAdminHtml(user.id)}', { status: this.value })">
        <option value="active" ${user.status === 'active' ? 'selected' : ''}>승인됨</option>
        <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>승인 대기 / 비활성</option>
      </select></td>
    `;
    listEl.appendChild(row);
  });
}

let diaryWeekStart = null;

function getMonday(date) {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getCurrentWorkweekStart() {
  const today = new Date();
  if (today.getDay() === 0) today.setDate(today.getDate() + 1);
  if (today.getDay() === 6) today.setDate(today.getDate() + 2);
  return getMonday(today);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function moveDiaryWeek(offset) {
  if (!diaryWeekStart) diaryWeekStart = getCurrentWorkweekStart();
  diaryWeekStart.setDate(diaryWeekStart.getDate() + offset * 7);
  renderDiaryWeekView();
}

function renderDiaryWeekView() {
  const container = document.getElementById('diary-list-container');
  if (!container) return;

  container.innerHTML = '';

  if (!diaryWeekStart) diaryWeekStart = getCurrentWorkweekStart();
  const labels = ['월요일', '화요일', '수요일', '목요일', '금요일'];
  const weekdays = labels.map((label, index) => {
    const date = new Date(diaryWeekStart);
    date.setDate(date.getDate() + index);
    return { label, date: formatLocalDate(date) };
  });
  const label = document.getElementById('diary-week-label');
  if (label) {
    const friday = new Date(diaryWeekStart); friday.setDate(friday.getDate() + 4);
    label.textContent = `${diaryWeekStart.getFullYear()}년 ${diaryWeekStart.getMonth() + 1}월 ${Math.ceil((diaryWeekStart.getDate() + new Date(diaryWeekStart.getFullYear(), diaryWeekStart.getMonth(), 1).getDay()) / 7)}주차 (${formatLocalDate(diaryWeekStart).slice(5)} ~ ${formatLocalDate(friday).slice(5)})`;
  }

  weekdays.forEach(day => {
    const dayDiaries = MOCK_DB.diaries.filter(d => d.date === day.date);
    const card = document.createElement('div');
    card.className = 'diary-day-card';

    let diariesHtml = '';
    dayDiaries.forEach(item => {
      const proj = MOCK_DB.projects.find(p => p.id === item.projectId);
      diariesHtml += `
        <div class="diary-item-node">
          <span class="project">${proj ? proj.name : '기타과업'}</span>
          <span class="time">${item.hours}H</span>
          <p>${item.content}</p>
          <button class="btn-sm-action" type="button" onclick="openDiaryAttachments('${item.id}')">첨부파일</button>
        </div>
      `;
    });

    if (dayDiaries.length === 0) {
      diariesHtml = '<p style="font-size:11px; text-align:center; padding:40px 0; color:var(--text-muted);">작성된 일지가 없습니다.</p>';
    }

    card.innerHTML = `
      <div class="diary-day-header">
        <h4>${day.label}</h4>
        <span class="date-lbl">${day.date.substring(5)}</span>
      </div>
      <div class="diary-day-body">
        ${diariesHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

async function openDiaryAttachments(diaryId) {
  const response = await fetch(`/api/attachments?diaryId=${encodeURIComponent(diaryId)}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '첨부파일을 불러오지 못했습니다.');
  if (!data.attachments.length) return alert('첨부파일이 없습니다.');
  const selected = window.prompt(`열 첨부파일 번호를 입력하세요.\n${data.attachments.map((file, index) => `${index + 1}. ${file.file_name}`).join('\n')}`);
  const file = data.attachments[Number(selected) - 1];
  if (!file) return;
  const link = await fetch('/api/attachments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: file.id }) });
  const result = await link.json();
  if (!link.ok) return alert(result.error || '첨부파일 링크를 만들지 못했습니다.');
  window.open(result.url, '_blank', 'noopener');
}


function openDiaryModal() {
  document.getElementById('modal-create-diary').classList.add('active');

  const select = document.getElementById('dy-project');
  select.innerHTML = '';
  MOCK_DB.projects.filter(p => p.active).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });

  document.getElementById('dy-date').value = formatLocalDate(diaryWeekStart || getCurrentWorkweekStart());
}

async function submitDiaryForm(e) {
  e.preventDefault();
  const date = document.getElementById('dy-date').value;
  const projectId = document.getElementById('dy-project').value;
  const hours = parseInt(document.getElementById('dy-hours').value);
  const content = document.getElementById('dy-content').value;

  const response = await fetch('/api/intranet-data?resource=diaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workDate: date, projectId, hours, content }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '업무일지 등록에 실패했습니다.');
  const files = Array.from(document.getElementById('dy-attachments')?.files || []);
  if (files.length) {
    const configResponse = await fetch('/api/attachment-config', { cache: 'no-store' });
    const config = await configResponse.json();
    if (!configResponse.ok) return alert(`업무일지는 저장됐지만 ${config.error || '첨부 설정을 불러오지 못했습니다.'}`);
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) return alert(`업무일지는 저장됐지만 ${file.name}은 50MB를 초과해 첨부하지 못했습니다.`);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-가-힣]/g, '_');
      const path = `${result.record.id}-${crypto.randomUUID()}-${safeName}`;
      const direct = await fetch(`${config.webdavUrl}/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', headers: { Authorization: `Basic ${btoa(`${config.token}:`)}`, 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!direct.ok) return alert(`업무일지는 저장됐지만 ${file.name} 업로드에 실패했습니다. (${direct.status})`);
      const metadata = await fetch('/api/attachments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ diaryId: result.record.id, fileName: file.name, contentType: file.type, byteSize: file.size, storagePath: path }) });
      const saved = await metadata.json();
      if (!metadata.ok) return alert(`파일은 업로드됐지만 기록 저장에 실패했습니다: ${saved.error || file.name}`);
    }
  }
  const newDiary = {
    id: result.record.id,
    date,
    projectId,
    hours,
    content
  };

  MOCK_DB.diaries.push(newDiary);
  saveAppState();
  closeModal('modal-create-diary');
  document.getElementById('diary-form').reset();

  alert('업무일지가 성공적으로 등록되었습니다.');

  if (activeSubView === 'diary') renderDiaryWeekView();
}
