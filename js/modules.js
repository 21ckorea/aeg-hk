function getTimesheetMonth() {
  return document.getElementById('ts-year-month')?.value || new Date().toISOString().slice(0, 7);
}

function getTimesheetDays() {
  const [year, month] = getTimesheetMonth().split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function getMonthDate(dayIndex) {
  return `${getTimesheetMonth()}-${String(dayIndex + 1).padStart(2, '0')}`;
}

function isProjectInputAllowed(project, workDate) {
  const assignment = MOCK_DB.assignedProjects.find(item => item.projectId === project.id);
  if (!project?.active || !assignment) return false;
  return (!project.startedOn || workDate >= project.startedOn)
    && (!project.endedOn || workDate <= project.endedOn)
    && (!assignment.startedOn || workDate >= assignment.startedOn)
    && (!assignment.endedOn || workDate <= assignment.endedOn);
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

  const assignedIds = new Set(MOCK_DB.assignedProjects.filter(item => isAssignmentActiveForMonth(item, getTimesheetMonth())).map(item => item.projectId));
  MOCK_DB.employees.forEach(emp => {
    if (!MOCK_DB.timesheets[emp.id]) {
      MOCK_DB.timesheets[emp.id] = {};
    }

    MOCK_DB.projects.filter(p => emp.id !== MOCK_DB.currentUser.id || assignedIds.has(p.id)).forEach(p => {
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
  let activeProjects = MOCK_DB.projects.filter(p => p.active && MOCK_DB.assignedProjects.some(item => item.projectId === p.id && isAssignmentActiveForMonth(item, getTimesheetMonth())));

  if (activeProjects.length === 0) {
    bodyHtml += `<tr><td colspan="${daysInMonth + 3}" style="text-align:center; padding:28px; color:var(--text-muted);">프로젝트가 아직 없습니다. 아래에서 새 프로젝트를 등록해 주세요.</td></tr>`;
  } else {
    activeProjects.forEach(p => {
      bodyHtml += '<tr>';
      bodyHtml += `<td><strong>${p.name}</strong><br><span style="font-size:10px; color:#64748b;">${p.role}</span><br><button class="btn-sm-action reject" type="button" onclick="removeProjectAssignment('${p.id}')">내 목록에서 제거</button></td>`;

      let projTotal = 0;
      for (let d = 0; d < daysInMonth; d++) {
        const dateClass = getTimesheetDayClass(d + 1);
        const workDate = getMonthDate(d);
        const canInput = isProjectInputAllowed(p, workDate);
        if (!canInput && ts[p.id]?.[d]) ts[p.id][d] = 0;
        const val = canInput ? (ts[p.id]?.[d] || 0) : 0;
        projTotal += val;
        bodyHtml += canInput
          ? `<td class="day-cell ${dateClass}"><input type="number" min="0" max="8" value="${val}" class="input-cell" onchange="updateCellHours('${activeUserId}', '${p.id}', ${d}, this.value)"></td>`
          : `<td class="day-cell ${dateClass}" title="프로젝트 또는 개인 배정 기간 전/후에는 입력할 수 없습니다."><span class="timesheet-unavailable">-</span></td>`;
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
  renderMobileTimesheetEditor();
}

function renderMobileTimesheetEditor() {
  const container = document.getElementById('timesheet-mobile-editor');
  if (!container) return;
  const [year, month] = getTimesheetMonth().split('-').map(Number);
  const daysInMonth = getTimesheetDays();
  const today = new Date();
  const defaultDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : 1;
  let selectedDay = Number(container.dataset.day || defaultDay);
  if (selectedDay < 1 || selectedDay > daysInMonth) selectedDay = 1;
  container.dataset.day = selectedDay;
  const activeUserId = MOCK_DB.currentUser.id;
  const timesheet = MOCK_DB.timesheets[activeUserId] || {};
  const dateKey = `${getTimesheetMonth()}-${String(selectedDay).padStart(2, '0')}`;
  const dayLabel = new Date(year, month - 1, selectedDay).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const rows = [
    ...MOCK_DB.projects.filter(project => isProjectInputAllowed(project, dateKey)).map(project => ({ id: project.id, name: project.name, role: project.role, hours: timesheet[project.id]?.[selectedDay - 1] || 0 })),
    { id: 'vacation', name: '개인휴가', role: '연차 · 반차', hours: timesheet.vacation?.[selectedDay - 1] || 0 }
  ];
  container.innerHTML = `
    <div class="mobile-timesheet-head">
      <label for="ts-mobile-date">입력 날짜</label>
      <input id="ts-mobile-date" type="date" min="${getTimesheetMonth()}-01" max="${getTimesheetMonth()}-${String(daysInMonth).padStart(2, '0')}" value="${dateKey}">
      <strong>${dayLabel} · 합계 ${getDayTotal(activeUserId, selectedDay - 1)}H / 8H</strong>
    </div>
    <div class="mobile-timesheet-list">
      ${rows.map(row => `<label class="mobile-timesheet-row"><span><strong>${row.name}</strong><small>${row.role || '프로젝트'}</small></span><input type="number" min="0" max="8" step="${row.id === 'vacation' ? 4 : 1}" value="${row.hours}" data-project-id="${row.id}"><em>시간</em></label>`).join('')}
    </div>`;
  container.querySelector('#ts-mobile-date').onchange = event => {
    container.dataset.day = Number(event.target.value.slice(-2));
    renderMobileTimesheetEditor();
  };
  container.querySelectorAll('[data-project-id]').forEach(input => {
    input.onchange = event => {
      updateCellHours(activeUserId, event.target.dataset.projectId, selectedDay - 1, event.target.value);
      renderMobileTimesheetEditor();
    };
  });
}

function getDayTotal(empId, dayIdx) {
  const ts = MOCK_DB.timesheets[empId];
  let total = 0;
  const isCurrentUser = empId === MOCK_DB.currentUser.id;
  const activeProjectIds = new Set(MOCK_DB.projects
    .filter(project => project.active && MOCK_DB.assignedProjects.some(item => item.projectId === project.id && isAssignmentActiveForMonth(item, getTimesheetMonth())))
    .map(project => project.id));

  MOCK_DB.projects.forEach(p => {
    if (ts[p.id] && (!isCurrentUser || (activeProjectIds.has(p.id) && isProjectInputAllowed(p, getMonthDate(dayIdx))))) total += ts[p.id][dayIdx] || 0;
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

  const month = getTimesheetMonth();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  const assigned = new Set(MOCK_DB.assignedProjects.filter(item => isAssignmentActiveForMonth(item, month)).map(item => item.projectId));
  const inactiveProjects = MOCK_DB.projects.filter(p => p.active && !assigned.has(p.id) && (!p.startedOn || p.startedOn <= monthEnd) && (!p.endedOn || p.endedOn >= monthStart));
  if (inactiveProjects.length === 0) return listContainer.innerHTML = '<p class="desc">현재 선택한 월에 추가할 수 있는 사전 등록 프로젝트가 없습니다.</p>';

  inactiveProjects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'project-choice-item';
    item.onclick = () => activateProjectRow(p.id);
    item.innerHTML = `
      <div>
        <h5>${p.name}</h5>
        <span class="role">기간: ${p.startedOn || '-'} ~ ${p.endedOn || '-'}</span>
      </div>
      <button class="btn-sm-action approve"><i data-lucide="plus"></i> 추가</button>
    `;
    listContainer.appendChild(item);
  });

  lucide.createIcons();
}

async function activateProjectRow(projId) {
  const proj = MOCK_DB.projects.find(p => p.id === projId);
  if (proj) {
    const response = await fetch('/api/intranet-data?resource=projectAssignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projId, yearMonth: getTimesheetMonth() }) });
    const result = await response.json();
    if (!response.ok) return alert(result.error || '프로젝트 추가에 실패했습니다.');
    // 서버가 확정한 기간을 그대로 반영한다. 이전 화면 상태가 남아 있어도 즉시 행이 표시된다.
    const record = result.record;
    const assignment = {
      projectId: record.project_id,
      plannedMm: Number(record.planned_mm || 0),
      startedOn: String(record.started_on || `${getTimesheetMonth()}-01`).slice(0, 10),
      endedOn: record.ended_on ? String(record.ended_on).slice(0, 10) : ''
    };
    const existingIndex = MOCK_DB.assignedProjects.findIndex(item => item.projectId === projId);
    if (existingIndex >= 0) MOCK_DB.assignedProjects.splice(existingIndex, 1, assignment);
    else MOCK_DB.assignedProjects.push(assignment);
    closeModal('modal-add-project');
    initTimesheets();
    saveAppState();
    renderTimesheet();
  }
}

function isAssignmentActiveForMonth(assignment, month) {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  return assignment.startedOn <= monthEnd && (!assignment.endedOn || assignment.endedOn >= monthStart);
}

async function removeProjectAssignment(projectId) {
  if (!window.confirm('선택한 월부터 이 프로젝트를 내 투입시간 목록에서 제거할까요? 이전 월의 기록은 유지됩니다.')) return;
  const response = await fetch('/api/intranet-data?resource=projectAssignments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, yearMonth: getTimesheetMonth() }) });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '프로젝트 제거에 실패했습니다.');
  const assignment = MOCK_DB.assignedProjects.find(item => item.projectId === projectId);
  if (assignment) {
    const [year, month] = getTimesheetMonth().split('-').map(Number);
    assignment.endedOn = formatLocalDate(new Date(year, month - 1, 0));
  }
  initTimesheets(); renderTimesheet(); alert('프로젝트를 내 목록에서 제거했습니다.');
}

async function saveTimesheet() {
  const current = MOCK_DB.timesheets[MOCK_DB.currentUser.id] || MOCK_DB.timesheets.emp01 || {};
  const requests = [];
  const month = getTimesheetMonth();
  const activeProjectIds = new Set(
    MOCK_DB.projects
      .filter(project => project.active && MOCK_DB.assignedProjects.some(item => item.projectId === project.id && isAssignmentActiveForMonth(item, month)))
      .map(project => project.id)
  );
  Object.entries(current).forEach(([projectId, hours]) => hours.forEach((value, day) => {
    const project = MOCK_DB.projects.find(item => item.id === projectId);
    const workDate = `${month}-${String(day + 1).padStart(2, '0')}`;
    if (Number(value) > 0 && (projectId === 'vacation' || (activeProjectIds.has(projectId) && isProjectInputAllowed(project, workDate)))) {
      const projectName = projectId === 'vacation' ? '개인휴가' : (project?.name || '알 수 없는 프로젝트');
      requests.push({ projectName, workDate, request: fetch('/api/intranet-data?resource=timesheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: projectId === 'vacation' ? null : projectId, entryType: projectId === 'vacation' ? 'vacation' : 'project', workDate, hours: Number(value) }) }) });
    }
  }));
  const results = await Promise.allSettled(requests.map(item => item.request));
  const failures = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status === 'rejected') {
      failures.push(`${requests[index].projectName} · ${requests[index].workDate}: 네트워크 연결을 확인한 뒤 다시 저장해 주세요.`);
    } else if (!result.value.ok) {
      const data = await result.value.json().catch(() => ({}));
      failures.push(`${requests[index].projectName} · ${requests[index].workDate}: ${data.error || '저장할 수 없습니다.'}`);
    }
  }
  if (failures.length) return alert(`다음 항목을 저장하지 못했습니다.\n\n${failures.join('\n\n')}`);
  saveAppState();
  alert('타임시트가 저장되었습니다.');
}

function submitTimesheet() {
  let errorFound = false;
  const activeUserId = MOCK_DB.currentUser.id;
  const daysInMonth = getTimesheetDays();
  for (let d = 0; d < daysInMonth; d++) {
    if (getDayTotal(activeUserId, d) > 8) {
      errorFound = true;
      break;
    }
  }

  let grandTotal = 0;
  for (let d = 0; d < daysInMonth; d++) {
    grandTotal += getDayTotal(activeUserId, d);
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
      <td data-label="프로젝트"><strong>${alloc.name}</strong></td>
      <td data-label="역할">${alloc.role}</td>
      <td data-label="총 투입시간">${alloc.hours}H</td>
      <td data-label="계산 M/M">${calculatedMM} M/M</td>
      <td data-label="확정 M/M"><input type="number" min="0" max="1" step="0.05" value="${confirmedMM}" style="width:70px; padding:3px; font-size:12px; border:1px solid var(--border-light); outline:none;"></td>
      <td data-label="비율" class="text-blue" style="font-weight:600;">${ratio}%</td>
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
  if (pendingBadge) {
    pendingBadge.textContent = pendingCount;
    pendingBadge.hidden = pendingCount === 0;
  }
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
      <td data-label="문서번호">${ap.id}</td>
      <td data-label="문서유형"><span class="badge" style="background:#e2e8f0; color:var(--text-dark);">${ap.type}</span></td>
      <td data-label="제목"><strong>${ap.title}</strong></td>
      <td data-label="기안자">${ap.drafter}</td>
      <td data-label="기안일자">${ap.date}</td>
      <td data-label="결재상태"><span class="badge-status ${badgeClass}">${statusText}</span></td>
      <td data-label="작업">
        <button class="btn-sm-action" onclick="openApprovalDetail('${ap.id}')">내용 보기</button>
        ${ap.status === 'waiting' ? `
          <button class="btn-sm-action approve" onclick="processApproval('${ap.id}', 'approved')">승인</button>
          <button class="btn-sm-action reject" onclick="processApproval('${ap.id}', 'rejected')">반려</button>
        ` : '<span style="color:var(--text-muted); font-size:11px;">처리완료</span>'}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function openApprovalDetail(approvalId) {
  const approval = MOCK_DB.approvals.find(item => item.id === approvalId);
  if (!approval) return alert('결재 문서를 찾을 수 없습니다.');
  document.getElementById('approval-detail-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'approval-detail-modal';
  modal.className = 'modal-backdrop active';
  modal.innerHTML = `
    <div class="modal-card approval-detail-modal-card">
      <div class="modal-header"><h3>결재 문서 내용</h3><button type="button" class="close-btn" aria-label="닫기">×</button></div>
      <div class="modal-body">
        <dl class="approval-detail-meta"><dt>문서유형</dt><dd></dd><dt>제목</dt><dd></dd><dt>기안자</dt><dd></dd><dt>기안일자</dt><dd></dd></dl>
        <h4>상세 내용</h4><div class="approval-detail-content"></div>
      </div>
    </div>`;
  const values = modal.querySelectorAll('.approval-detail-meta dd');
  [approval.type, approval.title, approval.drafter, approval.date].forEach((value, index) => { values[index].textContent = value || '-'; });
  modal.querySelector('.approval-detail-content').textContent = approval.content || '작성된 상세 내용이 없습니다.';
  const close = () => modal.remove();
  modal.querySelector('.close-btn').onclick = close;
  modal.onclick = event => { if (event.target === modal) close(); };
  document.body.appendChild(modal);
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
  const currentMonth = new Date().toISOString().slice(0, 7);
  const diariesThisMonth = MOCK_DB.diaries.filter(item => item.date.startsWith(currentMonth)).length;
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
  const pendingBadge = document.getElementById('pending-approval-count');
  const dashboardCount = document.getElementById('dashboard-pending-approvals');
  if (pendingBadge) {
    pendingBadge.textContent = pending.length;
    pendingBadge.hidden = pending.length === 0;
  }
  if (dashboardCount) dashboardCount.textContent = `${pending.length}건`;

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
  const pendingListEl = document.getElementById('admin-pending-user-list');
  const pendingCountEl = document.getElementById('admin-pending-user-count');
  const pendingBadgeEl = document.getElementById('pending-user-count');

  if (!countEl || !approvalEl || !listEl || !pendingListEl) return;

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
  const pendingUsers = users.filter(user => user.status === 'inactive');
  if (pendingCountEl) pendingCountEl.textContent = `${pendingUsers.length}명`;
  if (pendingBadgeEl) pendingBadgeEl.textContent = pendingUsers.length;

  pendingListEl.innerHTML = pendingUsers.length ? '' : '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">가입 승인 대기자가 없습니다.</td></tr>';
  pendingUsers.forEach(user => {
    const row = document.createElement('tr');
    const position = [user.job_rank, user.job_title].filter(Boolean).join(' / ') || '-';
    row.innerHTML = `
      <td>${escapeAdminHtml(user.name)}</td><td>${escapeAdminHtml(user.email)}</td><td>${escapeAdminHtml(position)}</td>
      <td><button class="btn-sm-action approve" onclick="updateUserAccess('${escapeAdminHtml(user.id)}', { status: 'active' })">승인</button></td>`;
    pendingListEl.appendChild(row);
  });

  listEl.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    const position = [user.job_rank, user.job_title].filter(Boolean).join(' / ') || '-';
    row.innerHTML = `
      <td>${escapeAdminHtml(user.name)}</td>
      <td>${escapeAdminHtml(user.email)}</td>
      <td>${escapeAdminHtml(position)}</td>
      <td><select aria-label="${escapeAdminHtml(user.name)} 권한 변경" onchange="updateUserAccess('${escapeAdminHtml(user.id)}', { role: this.value })">
        <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>직원</option>
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

let editingManagedProjectId = null;

function renderProjectManagement() {
  const list = document.getElementById('managed-project-list');
  if (!list) return;
  list.innerHTML = MOCK_DB.projects.length ? '' : '<tr><td colspan="7" style="text-align:center;padding:20px;">등록된 프로젝트가 없습니다.</td></tr>';
  MOCK_DB.projects.forEach(project => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeAdminHtml(project.code || '-')}</td><td><strong>${escapeAdminHtml(project.name)}</strong><br><small>${escapeAdminHtml(project.clientName || '')}</small></td><td>${project.startedOn || '-'} ~ ${project.endedOn || '-'}</td><td>${project.plannedMm || 0} M/M</td><td>${project.cost ? `${Number(project.cost).toLocaleString()}원` : '-'}</td><td>${project.active ? '운영 중' : '종료'}</td><td><button class="btn-sm-action" onclick="editManagedProject('${project.id}')">수정</button></td>`;
    list.appendChild(row);
  });
}

async function submitManagedProject(event) {
  event.preventDefault();
  const input = id => document.getElementById(id).value.trim();
  const isEditing = Boolean(editingManagedProjectId);
  const payload = { id: editingManagedProjectId, projectCode: input('pm-code'), name: input('pm-name'), clientName: input('pm-client'), workRole: input('pm-role'), startedOn: input('pm-start'), endedOn: input('pm-end'), contractAmount: input('pm-cost'), plannedMm: input('pm-mm'), isActive: document.getElementById('pm-active').value === 'true' };
  const response = await fetch('/api/intranet-data?resource=projects', { method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '프로젝트 등록에 실패했습니다.');
  const project = { id: data.record.id, code: data.record.project_code || '', name: data.record.name, clientName: data.record.client_name || '', role: data.record.work_role || '', active: data.record.is_active, startedOn: String(data.record.started_on).slice(0, 10), endedOn: String(data.record.ended_on).slice(0, 10), plannedMm: Number(data.record.planned_mm || 0), cost: Number(data.record.contract_amount || 0) };
  if (isEditing) MOCK_DB.projects = MOCK_DB.projects.map(item => item.id === project.id ? project : item); else MOCK_DB.projects.unshift(project);
  resetManagedProjectForm(); renderProjectManagement(); alert(isEditing ? '프로젝트를 수정했습니다.' : '프로젝트를 등록했습니다.');
}

function editManagedProject(projectId) {
  const project = MOCK_DB.projects.find(item => item.id === projectId);
  if (!project) return;
  editingManagedProjectId = projectId;
  document.getElementById('pm-code').value = project.code || '';
  document.getElementById('pm-name').value = project.name;
  document.getElementById('pm-client').value = project.clientName || '';
  document.getElementById('pm-role').value = project.role || '';
  document.getElementById('pm-start').value = project.startedOn || '';
  document.getElementById('pm-end').value = project.endedOn || '';
  document.getElementById('pm-cost').value = project.cost || '';
  document.getElementById('pm-mm').value = project.plannedMm || '';
  document.getElementById('pm-active').value = String(project.active);
  document.getElementById('pm-submit-button').textContent = '프로젝트 수정 저장';
  document.getElementById('pm-cancel-button').hidden = false;
  document.getElementById('pm-name').focus();
}

function resetManagedProjectForm() {
  editingManagedProjectId = null;
  document.getElementById('project-management-form')?.reset();
  document.getElementById('pm-active').value = 'true';
  document.getElementById('pm-submit-button').textContent = '프로젝트 등록';
  document.getElementById('pm-cancel-button').hidden = true;
}

let editingWbsTaskId = null;

function wbsStatusLabel(status) {
  return ({ planned: '예정', progress: '진행 중', done: '완료', delayed: '지연' })[status] || '예정';
}

function wbsShortRange(task) {
  const start = task.startedOn.slice(5).replace('-', '.');
  const end = task.endedOn.slice(5).replace('-', '.');
  return `(${start}~${end})`;
}

function renderWbs() {
  const projectSelect = document.getElementById('wbs-project-select');
  const monthInput = document.getElementById('wbs-month');
  const grid = document.getElementById('wbs-grid');
  if (!projectSelect || !monthInput || !grid) return;
  const previousProject = projectSelect.value;
  projectSelect.innerHTML = MOCK_DB.projects.map(project => `<option value="${project.id}">${escapeAdminHtml(project.name)}</option>`).join('');
  if (previousProject && MOCK_DB.projects.some(project => project.id === previousProject)) projectSelect.value = previousProject;
  if (!monthInput.value) monthInput.value = new Date().toISOString().slice(0, 7);
  const project = MOCK_DB.projects.find(item => item.id === projectSelect.value);
  const title = document.getElementById('wbs-project-title');
  if (!project) {
    if (title) title.textContent = '공정 일정';
    grid.innerHTML = '<tbody><tr><td>등록된 프로젝트가 없습니다.</td></tr></tbody>';
    return;
  }
  if (title) title.textContent = `${project.name} 공정 일정`;
  const [year, month] = monthInput.value.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  const tasks = MOCK_DB.wbsTasks.filter(task => task.projectId === project.id && task.startedOn <= `${monthInput.value}-${String(days).padStart(2, '0')}` && task.endedOn >= `${monthInput.value}-01`);
  const taskGroups = new Map();
  tasks.forEach(task => {
    const key = task.category || '미분류';
    if (!taskGroups.has(key)) taskGroups.set(key, []);
    taskGroups.get(key).push(task);
  });
  let html = `<thead><tr><th>공정</th>${Array.from({ length: days }, (_, index) => `<th>${index + 1}<small>${['일', '월', '화', '수', '목', '금', '토'][new Date(year, month - 1, index + 1).getDay()]}</small></th>`).join('')}<th>비고</th></tr></thead><tbody>`;
  if (!tasks.length) html += `<tr><td colspan="${days + 2}" class="wbs-empty">등록된 공정 작업이 없습니다. 아래에서 작업을 등록해 주세요.</td></tr>`;
  taskGroups.forEach((groupTasks, category) => {
    html += `<tr><td>${escapeAdminHtml(category)}</td>`;
    const orderedTasks = [...groupTasks].sort((a, b) => a.startedOn.localeCompare(b.startedOn));
    for (let day = 1; day <= days;) {
      const date = `${monthInput.value}-${String(day).padStart(2, '0')}`;
      const task = orderedTasks.find(item => item.startedOn <= date && item.endedOn >= date);
      if (!task) {
        html += '<td class="wbs-cell"></td>';
        day += 1;
        continue;
      }
      let endDay = task.endedOn.slice(0, 7) === monthInput.value ? Math.min(days, Number(task.endedOn.slice(-2))) : days;
      // 같은 공정의 다음 작업이 시작되면 그 전날까지만 한 막대로 표시한다.
      const nextTask = orderedTasks.find(item => item.id !== task.id && item.startedOn > date && item.startedOn <= `${monthInput.value}-${String(endDay).padStart(2, '0')}`);
      if (nextTask) endDay = Number(nextTask.startedOn.slice(-2)) - 1;
      const span = Math.max(1, endDay - day + 1);
      html += `<td colspan="${span}" class="wbs-cell wbs-span ${task.status}" role="button" tabindex="0" title="${escapeAdminHtml(task.note || '클릭하여 작업 수정')}" onclick="editWbsTask('${task.id}')"><b>${escapeAdminHtml(task.title)}</b><small>${wbsShortRange(task)}</small></td>`;
      day += span;
    }
    html += `<td>${escapeAdminHtml(groupTasks.map(task => task.note).filter(Boolean).join(' · ') || '-')}</td></tr>`;
  });
  grid.innerHTML = `${html}</tbody>`;
  const canEdit = ['admin', 'manager'].includes(MOCK_DB.currentUser.accessRole);
  document.getElementById('wbs-editor-panel').hidden = !canEdit;
  lucide.createIcons();
}

async function submitWbsTask(event) {
  event.preventDefault();
  const input = id => document.getElementById(id).value.trim();
  const isEditing = Boolean(editingWbsTaskId);
  const payload = { id: editingWbsTaskId, projectId: document.getElementById('wbs-project-select').value, category: input('wbs-category'), title: input('wbs-title'), startedOn: input('wbs-start'), endedOn: input('wbs-end'), status: document.getElementById('wbs-status').value, note: input('wbs-note') };
  const response = await fetch('/api/intranet-data?resource=wbs', { method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '공정 작업 저장에 실패했습니다.');
  const record = data.record;
  const task = { id: record.id, projectId: record.project_id, category: record.category || '', title: record.title, startedOn: String(record.started_on).slice(0, 10), endedOn: String(record.ended_on).slice(0, 10), status: record.status, note: record.note || '' };
  if (isEditing) MOCK_DB.wbsTasks = MOCK_DB.wbsTasks.map(item => item.id === task.id ? task : item); else MOCK_DB.wbsTasks.push(task);
  resetWbsForm(); renderWbs();
}

function editWbsTask(taskId) {
  const task = MOCK_DB.wbsTasks.find(item => item.id === taskId);
  if (!task) return;
  editingWbsTaskId = taskId;
  document.getElementById('wbs-category').value = task.category;
  document.getElementById('wbs-title').value = task.title;
  document.getElementById('wbs-start').value = task.startedOn;
  document.getElementById('wbs-end').value = task.endedOn;
  document.getElementById('wbs-status').value = task.status;
  document.getElementById('wbs-note').value = task.note;
  document.getElementById('wbs-form-title').textContent = '공정 작업 수정';
  document.getElementById('wbs-submit').textContent = '수정 저장';
  document.getElementById('wbs-cancel').hidden = false;
  document.getElementById('wbs-delete').hidden = false;
}

function resetWbsForm() {
  editingWbsTaskId = null;
  document.getElementById('wbs-form')?.reset();
  document.getElementById('wbs-form-title').textContent = '공정 작업 등록';
  document.getElementById('wbs-submit').textContent = '작업 등록';
  document.getElementById('wbs-cancel').hidden = true;
  document.getElementById('wbs-delete').hidden = true;
}

async function deleteWbsTask(taskId) {
  if (!window.confirm('이 공정 작업을 삭제할까요?')) return;
  const response = await fetch('/api/intranet-data?resource=wbs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId }) });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '공정 작업 삭제에 실패했습니다.');
  MOCK_DB.wbsTasks = MOCK_DB.wbsTasks.filter(item => item.id !== taskId);
  renderWbs();
}

let diaryWeekStart = null;
let editingDiaryId = null;

function getMonday(date) {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getCurrentWorkweekStart() {
  return getMonday(new Date());
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
  const labels = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
  const weekdays = labels.map((label, index) => {
    const date = new Date(diaryWeekStart);
    date.setDate(date.getDate() + index);
    return { label, date: formatLocalDate(date) };
  });
  const label = document.getElementById('diary-week-label');
  if (label) {
    const sunday = new Date(diaryWeekStart); sunday.setDate(sunday.getDate() + 6);
    label.textContent = `${diaryWeekStart.getFullYear()}년 ${diaryWeekStart.getMonth() + 1}월 ${Math.ceil((diaryWeekStart.getDate() + new Date(diaryWeekStart.getFullYear(), diaryWeekStart.getMonth(), 1).getDay()) / 7)}주차 (${formatLocalDate(diaryWeekStart).slice(5)} ~ ${formatLocalDate(sunday).slice(5)})`;
  }

  weekdays.forEach(day => {
    const dayDiaries = MOCK_DB.diaries.filter(d => d.date === day.date);
    const card = document.createElement('div');
    card.className = 'diary-day-card';

    let diariesHtml = '';
    dayDiaries.forEach(item => {
      const proj = MOCK_DB.projects.find(p => p.id === item.projectId);
      const canManage = item.userId === MOCK_DB.currentUser.id || MOCK_DB.currentUser.role.startsWith('관리자');
      diariesHtml += `
        <div class="diary-item-node">
          <span class="project">${proj ? proj.name : '기타과업'}</span>
          <span class="time">${item.hours}H</span>
          <p>${item.content}</p>
          <button class="btn-sm-action" type="button" onclick="openDiaryAttachments('${item.id}')">첨부파일 (${item.attachmentCount || 0})</button>
          ${canManage ? `<button class="btn-sm-action" type="button" onclick="editDiary('${item.id}')">수정</button><button class="btn-sm-action reject" type="button" onclick="deleteDiary('${item.id}')">삭제</button>` : ''}
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
  if (data.attachments.length === 1) return openDiaryAttachment(data.attachments[0].id);
  showDiaryAttachmentPicker(data.attachments);
}

function openDiaryAttachment(fileId) {
  window.open(`/api/attachments?fileId=${encodeURIComponent(fileId)}`, '_blank', 'noopener');
}

function showDiaryAttachmentPicker(attachments) {
  document.getElementById('diary-attachment-picker')?.remove();
  const picker = document.createElement('div');
  picker.id = 'diary-attachment-picker';
  picker.className = 'modal-backdrop active';
  picker.innerHTML = `
    <div class="modal-card attachment-picker-card">
      <div class="modal-header"><h3>첨부파일</h3><button class="close-btn" type="button" aria-label="닫기">×</button></div>
      <div class="modal-body"><p class="attachment-picker-guide">열 파일을 선택하세요.</p><div class="attachment-picker-list"></div></div>
    </div>`;
  const close = () => picker.remove();
  picker.querySelector('.close-btn').onclick = close;
  picker.onclick = event => { if (event.target === picker) close(); };
  const list = picker.querySelector('.attachment-picker-list');
  attachments.forEach(file => {
    const item = document.createElement('div');
    item.className = 'attachment-picker-item';
    const name = document.createElement('span');
    name.textContent = file.file_name;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-sm-action approve';
    button.textContent = '열기';
    button.onclick = () => { openDiaryAttachment(file.id); close(); };
    item.append(name, button);
    list.appendChild(item);
  });
  document.body.appendChild(picker);
}


function updateDiaryProjectOptions(workDate, selectedProjectId = '') {
  const select = document.getElementById('dy-project');
  const help = document.getElementById('dy-project-help');
  if (!select) return;
  select.innerHTML = '';
  const diaryMonth = String(workDate || formatLocalDate(diaryWeekStart || getCurrentWorkweekStart())).slice(0, 7);
  const available = MOCK_DB.projects.filter(p => p.active && MOCK_DB.assignedProjects.some(item => item.projectId === p.id && isAssignmentActiveForMonth(item, diaryMonth)));
  const selectedProject = selectedProjectId && MOCK_DB.projects.find(project => project.id === selectedProjectId);
  if (selectedProject && !available.some(project => project.id === selectedProjectId)) available.push(selectedProject);
  if (!available.length) {
    const option = new Option('선택 가능한 프로젝트가 없습니다.', '');
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    select.disabled = true;
    if (help) help.textContent = `${diaryMonth}에 내 투입 프로젝트가 없습니다. 투입시간 관리에서 해당 월의 프로젝트를 먼저 추가해 주세요.`;
    return;
  }
  select.disabled = false;
  if (help) help.textContent = '작성일이 속한 월에 추가된 프로젝트만 선택할 수 있습니다.';
  available.forEach((p, index) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    opt.selected = selectedProjectId ? p.id === selectedProjectId : index === 0;
    select.appendChild(opt);
  });
}

function openDiaryModal() {
  editingDiaryId = null;
  document.getElementById('diary-form').reset();
  document.getElementById('modal-create-diary').classList.add('active');

  const dateInput = document.getElementById('dy-date');
  dateInput.value = formatLocalDate(diaryWeekStart || getCurrentWorkweekStart());
  updateDiaryProjectOptions(dateInput.value);
  dateInput.onchange = () => updateDiaryProjectOptions(dateInput.value);
  document.querySelector('#modal-create-diary h3').textContent = '업무일지 기록 작성';
  document.querySelector('#diary-form button[type="submit"]').textContent = '일지 저장';
  document.getElementById('dy-existing-attachments').hidden = true;
  document.getElementById('dy-existing-attachments').innerHTML = '';
}

function editDiary(diaryId) {
  const item = MOCK_DB.diaries.find(diary => diary.id === diaryId);
  if (!item) return alert('업무일지를 찾을 수 없습니다.');
  editingDiaryId = diaryId;
  openDiaryModal();
  editingDiaryId = diaryId;
  document.getElementById('dy-date').value = item.date;
  updateDiaryProjectOptions(item.date, item.projectId || '');
  document.getElementById('dy-hours').value = item.hours;
  document.getElementById('dy-content').value = item.content;
  document.querySelector('#modal-create-diary h3').textContent = '업무일지 수정';
  document.querySelector('#diary-form button[type="submit"]').textContent = '수정 저장';
  loadDiaryAttachmentList(diaryId);
}

async function loadDiaryAttachmentList(diaryId) {
  const panel = document.getElementById('dy-existing-attachments');
  panel.hidden = false;
  panel.textContent = '기존 첨부파일을 불러오는 중…';
  try {
    const response = await fetch(`/api/attachments?diaryId=${encodeURIComponent(diaryId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    panel.innerHTML = data.attachments.length
      ? `<strong>기존 첨부파일</strong>${data.attachments.map(file => `<button type="button" class="btn-sm-action" onclick="window.open('/api/attachments?fileId=${encodeURIComponent(file.id)}', '_blank', 'noopener')">${file.file_name}</button>`).join('')}`
      : '<span>기존 첨부파일이 없습니다.</span>';
  } catch (error) {
    panel.textContent = error.message || '기존 첨부파일을 불러오지 못했습니다.';
  }
}

async function deleteDiary(diaryId) {
  if (!window.confirm('이 업무일지와 첨부파일을 삭제할까요? 삭제한 내용은 복구할 수 없습니다.')) return;
  const response = await fetch('/api/intranet-data?resource=diaries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: diaryId }) });
  const result = await response.json();
  if (!response.ok) return alert(result.error || '업무일지 삭제에 실패했습니다.');
  MOCK_DB.diaries = MOCK_DB.diaries.filter(item => item.id !== diaryId);
  renderDiaryWeekView();
  alert('업무일지를 삭제했습니다.');
}

async function submitDiaryForm(e) {
  e.preventDefault();
  const date = document.getElementById('dy-date').value;
  const projectId = document.getElementById('dy-project').value;
  const hours = parseInt(document.getElementById('dy-hours').value);
  const content = document.getElementById('dy-content').value;
  const attachments = Array.from(document.getElementById('dy-attachments').files || []);
  const tooLarge = attachments.find(file => file.size > 50 * 1024 * 1024);
  if (tooLarge) return alert(`'${tooLarge.name}' 파일은 50MB를 초과해 첨부할 수 없습니다.`);
  if (attachments.length && typeof window.uploadDiaryBlob !== 'function') {
    return alert('파일 업로드 기능을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
  }
  const submitButton = document.querySelector('#diary-form button[type="submit"]');
  const submitLabel = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = attachments.length ? '일지 저장 및 파일 업로드 중…' : '저장 중…';
  }

  try {
    const isEditing = Boolean(editingDiaryId);
    const response = await fetch('/api/intranet-data?resource=diaries', { method: isEditing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingDiaryId, workDate: date, projectId, hours, content }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '업무일지 등록에 실패했습니다.');
    for (let index = 0; index < attachments.length; index += 1) {
      const file = attachments[index];
      const uploaded = await window.uploadDiaryBlob(result.record.id, file, ({ percentage }) => {
        const rounded = Math.round(percentage || 0);
        if (submitButton) submitButton.textContent = `파일 업로드 중 (${index + 1}/${attachments.length}, ${rounded}%)`;
      });
      const attachmentResponse = await fetch('/api/attachments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diaryId: result.record.id, pathname: uploaded.pathname, fileName: file.name, contentType: file.type, byteSize: file.size })
      });
      const attachmentResult = await attachmentResponse.json();
      if (!attachmentResponse.ok) throw new Error(attachmentResult.error || '첨부파일 등록에 실패했습니다.');
    }
    const newDiary = {
      id: result.record.id,
      userId: result.record.user_id || MOCK_DB.currentUser.id,
      attachmentCount: isEditing ? undefined : attachments.length,
      date,
      projectId,
      hours,
      content
    };

    if (isEditing) MOCK_DB.diaries = MOCK_DB.diaries.map(item => item.id === newDiary.id ? { ...item, ...newDiary, attachmentCount: (item.attachmentCount || 0) + attachments.length } : item);
    else MOCK_DB.diaries.push(newDiary);
    saveAppState();
    closeModal('modal-create-diary');
    document.getElementById('diary-form').reset();
    alert(attachments.length ? '업무일지와 첨부파일이 저장되었습니다.' : (isEditing ? '업무일지를 수정했습니다.' : '업무일지가 성공적으로 등록되었습니다.'));

    if (activeSubView === 'diary') renderDiaryWeekView();
  } catch (error) {
    console.error('Diary attachment upload failed:', error);
    alert(error.message || '업무일지 또는 첨부파일 저장에 실패했습니다.');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  }
}
