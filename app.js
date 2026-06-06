/* ==================== APP.JS ==================== */

// --- GLOBAL MOCK DATABASE STATE ---
const MOCK_DB = {
  currentUser: {
    id: "emp01",
    name: "홍길동",
    role: "AA부서 / 과장",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
  },

  projects: [
    { id: "p1", name: "서초 포레스트 하이츠 재건축", role: "AA설계", active: true },
    { id: "p2", name: "용인 센트럴 파크빌 조합주택", role: "기획지원", active: true },
    { id: "p3", name: "판교 H-Tower 지식산업센터", role: "AA기획", active: true },
    { id: "p4", name: "성수 스마트 벨리 뉴타운 기획", role: "AA기획", active: false },
    { id: "p5", name: "민간 리테일 상가 기획", role: "설계지원", active: false }
  ],

  employees: [
    { id: "emp01", name: "홍길동", dept: "AA부서", rank: "과장", status: "normal", avatar: "H", joinDate: "2021.03.11" },
    { id: "emp02", name: "이영희", dept: "설계부서", rank: "대리", status: "incomplete", avatar: "Y", joinDate: "2023.08.01" },
    { id: "emp03", name: "김철수", dept: "AA부서", rank: "사원", status: "not-registered", avatar: "C", joinDate: "2025.10.15" },
    { id: "emp04", name: "박민서", dept: "PM부서", rank: "차장", status: "normal", avatar: "M", joinDate: "2018.05.20" },
    { id: "emp05", name: "최동훈", dept: "구조부서", rank: "부장", status: "normal", avatar: "D", joinDate: "2015.01.12" }
  ],

  // In-memory timesheets data: employee_id -> { project_id -> [30 days hours] }
  timesheets: {},

  // Electronic Approvals list
  approvals: [
    { id: "APP-2026-003", type: "연차휴가 신청서", title: "6월 15일 연차 휴가원 상신", drafter: "홍길동", date: "2026-06-05", status: "waiting", content: "서초 프로젝트 기본 기획 완료에 따른 휴가 사용원 청구의 건." },
    { id: "APP-2026-002", type: "업무보고서", title: "판교 H-Tower 1차 구조 안전진단 용역 기획서", drafter: "이영희", date: "2026-06-04", status: "waiting", content: "판교 상업 랜드마크 부지 관련 법규 보강 계획 및 정밀 계측 심의 결과 보고" },
    { id: "APP-2026-001", type: "출장신청서", title: "용인 현장 지반 조사 현지 출장 품의", drafter: "홍길동", date: "2026-06-02", status: "approved", content: "용인 센트럴 파크빌 지주 조합 경계 측량 및 암반 시추 테스트 진행" }
  ],

  // Diaries list
  diaries: [
    { id: "d1", date: "2026-06-01", projectId: "p1", hours: 4, content: "서초 포레스트 단지 조경 배치 설계 및 법정 의무 녹지 비율 체크" },
    { id: "d2", date: "2026-06-01", projectId: "p2", hours: 4, content: "용인 조합원 추가 분담금 시뮬레이션 자료 검토 및 기획회의 배포" },
    { id: "d3", date: "2026-06-02", projectId: "p1", hours: 6, content: "서초 도면 설계도서 보강 및 지반 구조 가이드라인 추가 보정" },
    { id: "d4", date: "2026-06-02", projectId: "p3", hours: 2, content: "판교 상업 용지 교통 영향 평가 법적 고시 내용 조사" },
    { id: "d5", date: "2026-06-03", projectId: "p3", hours: 8, content: "판교 H-Tower 층고 제한 해제 인허가 심사 도면 총괄 수정" },
    { id: "d6", date: "2026-06-04", projectId: "p1", hours: 4, content: "서초 소방 피난 동선 안전 시뮬레이션 결과 적용 설계 피드백" },
    { id: "d7", date: "2026-06-04", projectId: "p2", hours: 4, content: "용인 지주 조합 면담 지원 및 설계 기조 보고서 작성" },
    { id: "d8", date: "2026-06-05", projectId: "p1", hours: 8, content: "서초 프로젝트 주간 종합 공정률 점검 및 기본 도서 패키지 납품 준비" }
  ],

  attendance: {
    status: "out", // 'in' or 'out'
    checkInTime: null,
    checkOutTime: null,
    log: []
  }
};

// --- INITIALIZE TIMESHEETS DATABASE ---
function initTimesheets() {
  const daysInMonth = 30; // June 2026 has 30 days

  MOCK_DB.employees.forEach(emp => {
    MOCK_DB.timesheets[emp.id] = {};

    // Assign 3 active projects initially
    MOCK_DB.projects.forEach(p => {
      MOCK_DB.timesheets[emp.id][p.id] = new Array(daysInMonth).fill(0);
    });

    // Add Special Vacation Row
    MOCK_DB.timesheets[emp.id]["vacation"] = new Array(daysInMonth).fill(0);
  });

  // Populate Hong Gil-dong's timesheet with realistic mock values
  // Fill first week (June 1 to 5)
  // p1 (서초): M=4, T=6, W=0, T=4, F=8
  // p2 (용인): M=4, T=0, W=0, T=4, F=0
  // p3 (판교): M=0, T=2, W=8, T=0, F=0
  // Vacation: W=8 (연차휴가 6/3)
  const ts = MOCK_DB.timesheets["emp01"];
  ts["p1"][0] = 4; ts["p1"][1] = 6; ts["p1"][2] = 0; ts["p1"][3] = 4; ts["p1"][4] = 8;
  ts["p2"][0] = 4; ts["p2"][1] = 0; ts["p2"][2] = 0; ts["p2"][3] = 4; ts["p2"][4] = 0;
  ts["p3"][0] = 0; ts["p3"][1] = 2; ts["p3"][2] = 0; ts["p3"][3] = 0; ts["p3"][4] = 0;
  ts["vacation"][2] = 8; // Wed 6/3 is Vacation

  // Fill rest of month with some random base hours for rich data
  for (let d = 7; d < 30; d++) {
    const dayOfWeek = (d + 0) % 7; // June 1st is Mon (index 0)
    if (dayOfWeek < 5) { // Weekdays
      ts["p1"][d] = Math.random() > 0.5 ? 4 : 8;
      ts["p2"][d] = ts["p1"][d] === 4 ? 4 : 0;
    }
  }

  // Populate other employees with random data so charts are preloaded
  MOCK_DB.employees.slice(1).forEach(emp => {
    const empTs = MOCK_DB.timesheets[emp.id];
    for (let d = 0; d < 30; d++) {
      const dayOfWeek = d % 7;
      if (dayOfWeek < 5) {
        if (emp.status === "normal") {
          empTs["p1"][d] = Math.random() > 0.5 ? 6 : 4;
          empTs["p2"][d] = 8 - empTs["p1"][d];
        } else if (emp.status === "incomplete") {
          // incomplete status has missing days
          if (d < 15) {
            empTs["p1"][d] = 4;
            empTs["p2"][d] = 4;
          }
        }
      }
    }
  });
}


// --- CORE NAV ROUTER & VIEW CONTROLLER ---
function switchMainView(viewType) {
  const pubView = document.getElementById("view-public");
  const intraView = document.getElementById("view-intranet");
  const btnPub = document.getElementById("btn-toggle-public");
  const btnIntra = document.getElementById("btn-toggle-intranet");

  if (viewType === "public") {
    pubView.classList.add("active");
    intraView.classList.remove("active");
    btnPub.classList.add("active");
    btnIntra.classList.remove("active");
  } else {
    pubView.classList.remove("active");
    intraView.classList.add("active");
    btnPub.classList.remove("active");
    btnIntra.classList.add("active");

    // Automatically render active sub-view
    switchSubView("dashboard");
    initializeIntranetClock();
  }
  lucide.createIcons();
}

let activeSubView = "dashboard";
function switchSubView(subViewId) {
  // Update sidebar active classes
  const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
  menuItems.forEach(item => item.classList.remove("active"));

  const targetMenu = document.getElementById(`menu-${subViewId}`);
  if (targetMenu) targetMenu.classList.add("active");

  // Show corresponding sub-view panel
  const subViews = document.querySelectorAll(".intra-content .sub-view");
  subViews.forEach(view => view.classList.remove("active"));

  const targetView = document.getElementById(`sub-${subViewId}`);
  if (targetView) targetView.classList.add("active");

  // Update Page Title
  const titleDisplay = document.getElementById("intra-page-title");
  const titles = {
    dashboard: "인트라넷 대시보드",
    timesheet: "투입시간 관리 (Timesheet Input)",
    manpower: "인력 투입 분석 (Manpower Allocation)",
    approval: "전자결재 문서함",
    attendance: "사내 근태 관리",
    diary: "주간 업무일지"
  };
  titleDisplay.textContent = titles[subViewId] || "사내 시스템";

  activeSubView = subViewId;

  // Initialize specific sub-view components
  if (subViewId === "dashboard") {
    renderDashboardApprovals();
  } else if (subViewId === "timesheet") {
    renderTimesheet();
  } else if (subViewId === "manpower") {
    renderManpowerAnalysis();
  } else if (subViewId === "approval") {
    renderApprovalsTable();
  } else if (subViewId === "diary") {
    renderDiaryWeekView();
  } else if (subViewId === "attendance") {
    renderAttendancePageClock();
  }

  lucide.createIcons();
}


// --- ① PUBLIC SITE HERO SLIDER ---
let currentSlide = 0;
let slideInterval = null;

function startHeroSlider() {
  const slides = document.querySelectorAll(".hero-slider .slide");
  if (slides.length === 0) return;

  slideInterval = setInterval(() => {
    moveSlide(1);
  }, 5000);
}

function moveSlide(direction) {
  const slides = document.querySelectorAll(".hero-slider .slide");
  const dots = document.querySelectorAll(".hero-slider .dot");
  if (slides.length === 0) return;

  slides[currentSlide].classList.remove("active");
  dots[currentSlide].classList.remove("active");

  currentSlide = (currentSlide + direction + slides.length) % slides.length;

  slides[currentSlide].classList.add("active");
  dots[currentSlide].classList.add("active");
}

function setSlide(slideIndex) {
  const slides = document.querySelectorAll(".hero-slider .slide");
  const dots = document.querySelectorAll(".hero-slider .dot");
  if (slides.length === 0) return;

  slides[currentSlide].classList.remove("active");
  dots[currentSlide].classList.remove("active");

  currentSlide = slideIndex;

  slides[currentSlide].classList.add("active");
  dots[currentSlide].classList.add("active");

  // Reset timer interval on manual click
  clearInterval(slideInterval);
  startHeroSlider();
}

function toggleMobileMenu() {
  const nav = document.getElementById("pub-mobile-nav");
  nav.classList.toggle("active");
}

// Featured portfolio project category filter
function filterFeatured(category) {
  // Set active filter button
  const filterBtns = document.querySelectorAll(".filter-buttons .filter-btn");
  filterBtns.forEach(btn => btn.classList.remove("active"));

  const targetBtn = document.getElementById(`f-${category}`);
  if (targetBtn) targetBtn.classList.add("active");

  // Hide or show project cards
  const projectCards = document.querySelectorAll(".projects-grid .project-card");
  projectCards.forEach(card => {
    if (category === "all" || card.getAttribute("data-cat") === category) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });
}


// --- ② BLUEPRINT DRAWER CONTROLLER ---
function toggleBlueprintDrawer() {
  const drawer = document.getElementById("blueprint-drawer");
  drawer.classList.toggle("active");
}

function changeBlueprintImage() {
  const selector = document.getElementById("blueprint-select");
  const viewer = document.getElementById("blueprint-img-viewer");
  const selection = selector.value;

  const images = {
    timesheet: "./docs/images/timesheet_input_wireframe_1780702852142.png",
    manpower: "./docs/images/manpower_analysis_wireframe_1780702887158.png",
    homepage: "./docs/images/homepage_wireframe_desktop_1780702409608.png",
    intranet: "./docs/images/intranet_wireframe_desktop_1780702434285.png",
    subpages: "./docs/images/intranet_sub_pages_wireframe_1780702459207.png",
    mobile: "./docs/images/mobile_wireframe_responsive_1780702486877.png"
  };

  viewer.src = images[selection] || "";
}


// --- ③ INTRANET MOCK CLOCK SYSTEM ---
function initializeIntranetClock() {
  updateTime();
  setInterval(updateTime, 1000);
}

function updateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const dateDisplay = document.getElementById("live-date");
  const timeDisplay = document.getElementById("live-time");

  if (dateDisplay) dateDisplay.textContent = dateStr;
  if (timeDisplay) timeDisplay.textContent = timeStr;

  // Also update attendance page clock if active
  const attClock = document.getElementById("attendance-page-time");
  const quickClock = document.getElementById("quick-time-stamp");
  if (attClock) attClock.textContent = timeStr;
  if (quickClock) quickClock.textContent = timeStr;
}


// --- ④ TIMESHEET GRID CONTROLLER (SECTION A) ---
function renderTimesheet() {
  const table = document.getElementById("timesheet-grid-table");
  if (!table) return;

  const daysInMonth = 30; // June has 30 days
  const ts = MOCK_DB.timesheets["emp01"]; // Current User

  // 1. Build Header Row
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
    const dayOfWeek = (d - 1) % 7; // June 1st is Monday (index 0)
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // 5=Sat, 6=Sun
    headHtml += `<th class="day-col day-header ${isWeekend ? 'weekend' : ''}">${d}</th>`;
  }
  headHtml += `</tr></thead>`;

  // 2. Build Project Rows
  let bodyHtml = `<tbody>`;
  let activeProjects = MOCK_DB.projects.filter(p => p.active);

  activeProjects.forEach(p => {
    bodyHtml += `<tr>`;
    bodyHtml += `<td><strong>${p.name}</strong><br><span style="font-size:10px; color:#64748b;">${p.role}</span></td>`;

    let projTotal = 0;
    for (let d = 0; d < daysInMonth; d++) {
      const dayOfWeek = d % 7;
      const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
      const val = ts[p.id][d] || 0;
      projTotal += val;
      bodyHtml += `
        <td class="day-cell ${isWeekend ? 'weekend' : ''}">
          <input type="number" min="0" max="8" value="${val}" class="input-cell" 
                 onchange="updateCellHours('emp01', '${p.id}', ${d}, this.value)">
        </td>
      `;
    }

    const calculatedMM = (projTotal / 176).toFixed(3);
    bodyHtml += `<td class="summary-col" id="total-${p.id}">${projTotal}H</td>`;
    bodyHtml += `<td class="summary-col text-blue" id="mm-${p.id}">${calculatedMM} M/M</td>`;
    bodyHtml += `</tr>`;
  });

  // 3. Vacation Row
  bodyHtml += `<tr>`;
  bodyHtml += `<td><strong>개인휴가 행</strong><br><span style="font-size:10px; color:#64748b;">연차/반차 반출</span></td>`;
  let vacTotal = 0;
  for (let d = 0; d < daysInMonth; d++) {
    const dayOfWeek = d % 7;
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
    const val = ts["vacation"][d] || 0;
    vacTotal += val;
    bodyHtml += `
      <td class="day-cell ${isWeekend ? 'weekend' : ''}">
        <input type="number" min="0" max="8" step="4" value="${val}" class="input-cell" style="color:var(--primary); font-weight:700;"
               onchange="updateCellHours('emp01', 'vacation', ${d}, this.value)">
      </td>
    `;
  }
  bodyHtml += `<td class="summary-col" id="total-vacation">${vacTotal}H</td>`;
  bodyHtml += `<td class="summary-col text-blue">-</td>`;
  bodyHtml += `</tr>`;

  // 4. Day Totals Row
  bodyHtml += `<tr class="day-total-row">`;
  bodyHtml += `<td><strong>일별 합산 (최대 8H)</strong></td>`;
  for (let d = 0; d < daysInMonth; d++) {
    const dayTotal = getDayTotal("emp01", d);
    const isExceeded = dayTotal > 8;
    bodyHtml += `<td class="${isExceeded ? 'exceeded' : 'valid'}" id="daytotal-${d}">${dayTotal}</td>`;
  }
  bodyHtml += `<td class="summary-col" id="ts-grid-grand-total">0H</td>`;
  bodyHtml += `<td class="summary-col" id="ts-grid-grand-mm">0.000 M/M</td>`;
  bodyHtml += `</tr></tbody>`;

  table.innerHTML = headHtml + bodyHtml;

  updateTimesheetSummaries();
}

function getDayTotal(empId, dayIdx) {
  const ts = MOCK_DB.timesheets[empId];
  let total = 0;

  MOCK_DB.projects.forEach(p => {
    if (ts[p.id]) total += ts[p.id][dayIdx] || 0;
  });
  if (ts["vacation"]) total += ts["vacation"][dayIdx] || 0;

  return total;
}

function updateCellHours(empId, projId, dayIdx, value) {
  const parsedVal = Math.max(0, Math.min(8, parseInt(value) || 0));
  MOCK_DB.timesheets[empId][projId][dayIdx] = parsedVal;

  // Recalculate Project Row Total & MM
  let projTotal = 0;
  const daysInMonth = 30;
  for (let d = 0; d < daysInMonth; d++) {
    projTotal += MOCK_DB.timesheets[empId][projId][d] || 0;
  }

  const totalCell = document.getElementById(`total-${projId}`);
  if (totalCell) totalCell.textContent = `${projTotal}H`;

  const mmCell = document.getElementById(`mm-${projId}`);
  if (mmCell && projId !== "vacation") {
    mmCell.textContent = `${(projTotal / 176).toFixed(3)} M/M`;
  }

  // Recalculate Day Total
  const dayTotal = getDayTotal(empId, dayIdx);
  const dayTotalCell = document.getElementById(`daytotal-${dayIdx}`);
  if (dayTotalCell) {
    dayTotalCell.textContent = dayTotal;
    if (dayTotal > 8) {
      dayTotalCell.className = "exceeded";
    } else {
      dayTotalCell.className = "valid";
    }
  }

  updateTimesheetSummaries();
}

function updateTimesheetSummaries() {
  const daysInMonth = 30;
  let grandTotal = 0;

  for (let d = 0; d < daysInMonth; d++) {
    grandTotal += getDayTotal("emp01", d);
  }

  const targetDisplay = document.getElementById("ts-total-input-hours");
  if (targetDisplay) {
    targetDisplay.textContent = `${grandTotal}H`;
    if (grandTotal > 176) {
      targetDisplay.style.color = "var(--accent-red)";
      targetDisplay.style.fontWeight = "800";
    } else {
      targetDisplay.style.color = "var(--text-dark)";
      targetDisplay.style.fontWeight = "700";
    }
  }

  const gridGrand = document.getElementById("ts-grid-grand-total");
  if (gridGrand) {
    gridGrand.textContent = `${grandTotal}H`;
    if (grandTotal > 176) {
      gridGrand.style.backgroundColor = "#fee2e2";
      gridGrand.style.color = "var(--accent-red)";
    } else {
      gridGrand.style.backgroundColor = "transparent";
      gridGrand.style.color = "var(--text-dark)";
    }
  }

  const gridGrandMM = document.getElementById("ts-grid-grand-mm");
  if (gridGrandMM) {
    const mm = (grandTotal / 176).toFixed(3);
    gridGrandMM.textContent = `${mm} M/M`;
    if (grandTotal > 176) {
      gridGrandMM.style.backgroundColor = "#fee2e2";
      gridGrandMM.style.color = "var(--accent-red)";
    } else {
      gridGrandMM.style.backgroundColor = "transparent";
      gridGrandMM.style.color = "var(--text-dark)";
    }
  }
}

// Dialog Popups
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function addProjectRowPopup() {
  const modal = document.getElementById("modal-add-project");
  modal.classList.add("active");

  const listContainer = document.getElementById("modal-project-choices");
  listContainer.innerHTML = "";

  // Find inactive projects
  const inactiveProjects = MOCK_DB.projects.filter(p => !p.active);
  if (inactiveProjects.length === 0) {
    listContainer.innerHTML = `<p style="font-size:13px; color:var(--text-muted);">더 이상 추가 가능한 프로젝트가 없습니다.</p>`;
    return;
  }

  inactiveProjects.forEach(p => {
    const item = document.createElement("div");
    item.className = "project-choice-item";
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

function activateProjectRow(projId) {
  const proj = MOCK_DB.projects.find(p => p.id === projId);
  if (proj) {
    proj.active = true;
    closeModal("modal-add-project");
    renderTimesheet();
  }
}

function saveTimesheet() {
  alert("타임시트 진행 내역이 서버에 임시저장되었습니다.");
}

function submitTimesheet() {
  // Check if any day exceeds 8 hours
  let errorFound = false;
  for (let d = 0; d < 30; d++) {
    if (getDayTotal("emp01", d) > 8) {
      errorFound = true;
      break;
    }
  }

  // Check if total monthly hours exceeds 176 hours (1 M/M)
  let grandTotal = 0;
  for (let d = 0; d < 30; d++) {
    grandTotal += getDayTotal("emp01", d);
  }

  if (errorFound) {
    alert("⚠️ 입력오류: 하루 최대 8시간을 초과하여 배분된 날짜가 있습니다. 수정 후 제출해주세요.");
  } else if (grandTotal > 176) {
    alert(`⚠️ 입력오류: 1달 총 투입시간 합계가 1 M/M (176시간)을 초과할 수 없습니다. 현재 투입합계: ${grandTotal}H (${(grandTotal / 176).toFixed(3)} M/M)`);
  } else {
    alert("✅ 제출성공: 6월 M/M 타임시트 정보가 마감 제출되었습니다.");
  }
}


// --- ⑤ MANPOWER ANALYSIS CONTROLLER (SECTION B) ---
let manpowerViewMode = "employee"; // or 'project'
let activeEmployeeId = "emp01";

function setManpowerViewMode(mode) {
  manpowerViewMode = mode;
  document.getElementById("btn-view-by-emp").classList.toggle("active", mode === "employee");
  document.getElementById("btn-view-by-proj").classList.toggle("active", mode === "project");

  renderManpowerAnalysis();
}

function renderManpowerAnalysis() {
  renderEmployeeList();
  renderEmployeeDetails(activeEmployeeId);
}

function renderEmployeeList() {
  const container = document.getElementById("manpower-employee-list");
  if (!container) return;

  container.innerHTML = "";

  MOCK_DB.employees.forEach(emp => {
    // Calculate totals dynamically
    let totalHours = 0;
    const ts = MOCK_DB.timesheets[emp.id];
    Object.keys(ts).forEach(projId => {
      ts[projId].forEach(h => totalHours += h);
    });
    const totalMM = (totalHours / 176).toFixed(1);

    const item = document.createElement("div");
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

  // Re-add active styles to list
  const items = document.querySelectorAll(".employee-list .employee-item");
  items.forEach(item => item.classList.remove("active"));

  renderManpowerAnalysis();
}

function filterEmployees() {
  const query = document.getElementById("emp-search").value.toLowerCase();
  const items = document.querySelectorAll(".employee-list .employee-item");

  MOCK_DB.employees.forEach((emp, index) => {
    const target = items[index];
    if (emp.name.toLowerCase().includes(query) || emp.dept.toLowerCase().includes(query)) {
      target.style.display = "flex";
    } else {
      target.style.display = "none";
    }
  });
}

function renderEmployeeDetails(empId) {
  const emp = MOCK_DB.employees.find(e => e.id === empId);
  const ts = MOCK_DB.timesheets[empId];
  if (!emp || !ts) return;

  // Header Details
  document.getElementById("detail-emp-avatar").textContent = emp.avatar;
  document.getElementById("detail-emp-name").textContent = `${emp.name} ${emp.rank}`;
  document.getElementById("detail-emp-dept").textContent = `${emp.dept} | 입사일: ${emp.joinDate}`;

  // 1. Calculate Allocation data
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

  // Render Cumulative Progress Bar Charts
  const chartContainer = document.getElementById("manpower-bar-chart");
  chartContainer.innerHTML = "";

  if (allocations.length === 0) {
    chartContainer.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">투입 기록이 없습니다.</p>`;
  }

  allocations.forEach(alloc => {
    const percent = grandTotal > 0 ? Math.round((alloc.hours / grandTotal) * 100) : 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="week-lbl" title="${alloc.name}">${alloc.name}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${percent}%;"></div>
      </div>
      <span class="hours">${percent}%</span>
    `;
    chartContainer.appendChild(row);
  });

  // 2. Render Calendar Heatmap (Section B-3)
  const heatmap = document.getElementById("manpower-heatmap-grid");
  heatmap.innerHTML = "";

  const daysInMonth = 30;
  for (let d = 0; d < daysInMonth; d++) {
    const dayTotal = getDayTotal(empId, d);
    let levelClass = "level-0";
    if (dayTotal > 0 && dayTotal <= 3) levelClass = "level-1";
    else if (dayTotal > 3 && dayTotal <= 6) levelClass = "level-2";
    else if (dayTotal > 6) levelClass = "level-3";

    const cell = document.createElement("div");
    cell.className = `heatmap-cell ${levelClass}`;
    cell.textContent = dayTotal;
    cell.title = `6월 ${d + 1}일: ${dayTotal}시간 투입`;
    heatmap.appendChild(cell);
  }

  // 3. Render Table List
  const tbody = document.querySelector("#manpower-allocation-table tbody");
  tbody.innerHTML = "";

  if (allocations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">배정 명세가 없습니다.</td></tr>`;
    return;
  }

  allocations.forEach(alloc => {
    const calculatedMM = (alloc.hours / 176).toFixed(3);
    const confirmedMM = calculatedMM; // Sync with calc M/M for mock
    const ratio = grandTotal > 0 ? ((alloc.hours / grandTotal) * 100).toFixed(1) : 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${alloc.name}</strong></td>
      <td>${alloc.role}</td>
      <td>${alloc.hours}H</td>
      <td>${calculatedMM} M/M</td>
      <td><input type="number" min="0" max="1" step="0.05" value="${confirmedMM}" 
                 style="width:70px; padding:3px; font-size:12px; border:1px solid var(--border-light); outline:none;"></td>
      <td class="text-blue" style="font-weight:600;">${ratio}%</td>
    `;
    tbody.appendChild(row);
  });
}


// --- ⑥ ELECTRONIC APPROVALS CONTROLLER ---
let activeApprovalTab = "waiting";

function switchApprovalTab(tabId) {
  activeApprovalTab = tabId;
  const tabBtns = document.querySelectorAll(".tab-buttons .tab-btn");
  tabBtns.forEach(btn => btn.classList.remove("active"));

  // Apply active class to clicked button
  event.target.classList.add("active");
  renderApprovalsTable();
}

function renderApprovalsTable() {
  const tbody = document.getElementById("approval-list-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  // Filter approvals based on status
  let filtered = MOCK_DB.approvals;
  if (activeApprovalTab === "waiting") {
    filtered = MOCK_DB.approvals.filter(a => a.status === "waiting");
  } else if (activeApprovalTab === "sent") {
    filtered = MOCK_DB.approvals.filter(a => a.drafter === MOCK_DB.currentUser.name);
  } else if (activeApprovalTab === "completed") {
    filtered = MOCK_DB.approvals.filter(a => a.status === "approved" || a.status === "rejected");
  }

  // Update counts
  const pendingCount = MOCK_DB.approvals.filter(a => a.status === "waiting").length;
  document.getElementById("pending-approval-count").textContent = pendingCount;
  const dashCount = document.getElementById("dashboard-pending-approvals");
  if (dashCount) dashCount.textContent = `${pendingCount}건`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">문서가 존재하지 않습니다.</td></tr>`;
    return;
  }

  filtered.forEach(ap => {
    let badgeClass = "waiting";
    let statusText = "대기중";
    if (ap.status === "approved") { badgeClass = "approved"; statusText = "승인완료"; }
    else if (ap.status === "rejected") { badgeClass = "rejected"; statusText = "반려"; }

    const row = document.createElement("tr");
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
        ` : `<span style="color:var(--text-muted); font-size:11px;">처리완료</span>`}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function processApproval(apId, action) {
  const ap = MOCK_DB.approvals.find(a => a.id === apId);
  if (ap) {
    ap.status = action;
    alert(`[결재 알림] ${ap.title} 건이 ${action === 'approved' ? '승인' : '반려'} 처리되었습니다.`);
    renderApprovalsTable();
    renderDashboardApprovals();
  }
}

function openApprovalModal() {
  document.getElementById("modal-create-approval").classList.add("active");
}

function submitApprovalForm(e) {
  e.preventDefault();
  const type = document.getElementById("ap-type").value;
  const title = document.getElementById("ap-title").value;
  const content = document.getElementById("ap-content").value;

  const newAp = {
    id: `APP-2026-00${MOCK_DB.approvals.length + 1}`,
    type,
    title,
    drafter: MOCK_DB.currentUser.name,
    date: new Date().toISOString().split('T')[0],
    status: "waiting",
    content
  };

  MOCK_DB.approvals.unshift(newAp);
  closeModal("modal-create-approval");
  document.getElementById("approval-form").reset();

  alert("기안이 완료되어 상신되었습니다.");

  if (activeSubView === "approval") renderApprovalsTable();
  renderDashboardApprovals();
}


// --- ⑦ DASHBOARD PORTLET RENDERER ---
function renderDashboardApprovals() {
  const container = document.getElementById("dashboard-approvals-container");
  if (!container) return;

  container.innerHTML = "";
  const pending = MOCK_DB.approvals.filter(a => a.status === "waiting");

  if (pending.length === 0) {
    container.innerHTML = `<p style="padding:30px; text-align:center; font-size:13px; color:var(--text-muted);">대기 중인 결재가 없습니다.</p>`;
    return;
  }

  pending.slice(0, 3).forEach(ap => {
    const item = document.createElement("div");
    item.className = "approval-item";
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


// --- ⑧ ATTENDANCE CLOCK SIMULATOR ---
function performCheckIn() {
  const now = new Date();
  MOCK_DB.attendance.status = "in";
  MOCK_DB.attendance.checkInTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  MOCK_DB.attendance.checkOutTime = null;

  alert(`출근 등록이 완료되었습니다. (등록시간: ${MOCK_DB.attendance.checkInTime})`);

  // Sync views
  updateAttendanceUI();
}

function performCheckOut() {
  const now = new Date();
  MOCK_DB.attendance.status = "out";
  MOCK_DB.attendance.checkOutTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  alert(`퇴근 등록이 완료되었습니다. (등록시간: ${MOCK_DB.attendance.checkOutTime})`);

  // Add log entry
  MOCK_DB.attendance.log.push({
    date: now.toLocaleDateString("ko-KR"),
    in: MOCK_DB.attendance.checkInTime,
    out: MOCK_DB.attendance.checkOutTime
  });

  updateAttendanceUI();
}

function updateAttendanceUI() {
  const status = MOCK_DB.attendance.status;
  const inBtn = document.getElementById("btn-quick-check-in");
  const outBtn = document.getElementById("btn-quick-check-out");
  const inBtnLarge = document.getElementById("btn-check-in-large");
  const outBtnLarge = document.getElementById("btn-check-out-large");

  const quickStatus = document.getElementById("quick-check-status");

  if (status === "in") {
    if (quickStatus) {
      quickStatus.textContent = "출근 완료";
      quickStatus.className = "status-badge in";
    }

    // Toggle active state
    if (inBtn) inBtn.classList.add("disabled");
    if (outBtn) outBtn.classList.remove("disabled");
    if (inBtnLarge) inBtnLarge.classList.add("disabled");
    if (outBtnLarge) outBtnLarge.classList.remove("disabled");
  } else {
    if (quickStatus) {
      quickStatus.textContent = "퇴근 완료";
      quickStatus.className = "status-badge out";
    }

    if (inBtn) inBtn.classList.remove("disabled");
    if (outBtn) outBtn.classList.add("disabled");
    if (inBtnLarge) inBtnLarge.classList.remove("disabled");
    if (outBtnLarge) outBtnLarge.classList.add("disabled");
  }

  // Render log
  const logContainer = document.getElementById("attendance-log-today");
  if (logContainer) {
    if (MOCK_DB.attendance.checkInTime) {
      logContainer.innerHTML = `
        <div style="font-size:13px; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span>출근시간: <strong>${MOCK_DB.attendance.checkInTime}</strong></span>
          <span>퇴근시간: <strong>${MOCK_DB.attendance.checkOutTime || '--:--'}</strong></span>
        </div>
      `;
    } else {
      logContainer.innerHTML = `<span style="font-size:13px; color:var(--text-muted);">근무 등록 내역이 없습니다.</span>`;
    }
  }
}

function renderAttendancePageClock() {
  updateAttendanceUI();
}


// --- ⑨ WORK DIARY MANAGEMENT ---
function renderDiaryWeekView() {
  const container = document.getElementById("diary-list-container");
  if (!container) return;

  container.innerHTML = "";

  // Render Monday to Friday cards for June 1 to 5
  const weekdays = [
    { label: "월요일", date: "2026-06-01" },
    { label: "화요일", date: "2026-06-02" },
    { label: "수요일", date: "2026-06-03" },
    { label: "목요일", date: "2026-06-04" },
    { label: "금요일", date: "2026-06-05" }
  ];

  weekdays.forEach(day => {
    const dayDiaries = MOCK_DB.diaries.filter(d => d.date === day.date);

    const card = document.createElement("div");
    card.className = "diary-day-card";

    let diariesHtml = "";
    dayDiaries.forEach(item => {
      const proj = MOCK_DB.projects.find(p => p.id === item.projectId);
      diariesHtml += `
        <div class="diary-item-node">
          <span class="project">${proj ? proj.name : '기타과업'}</span>
          <span class="time">${item.hours}H</span>
          <p>${item.content}</p>
        </div>
      `;
    });

    if (dayDiaries.length === 0) {
      diariesHtml = `<p style="font-size:11px; text-align:center; padding:40px 0; color:var(--text-muted);">작성된 일지가 없습니다.</p>`;
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

function openDiaryModal() {
  document.getElementById("modal-create-diary").classList.add("active");

  // Populate project select list
  const select = document.getElementById("dy-project");
  select.innerHTML = "";
  MOCK_DB.projects.filter(p => p.active).forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });

  // Default date as June 5th (Fri) or current date
  document.getElementById("dy-date").value = "2026-06-05";
}

function submitDiaryForm(e) {
  e.preventDefault();
  const date = document.getElementById("dy-date").value;
  const projectId = document.getElementById("dy-project").value;
  const hours = parseInt(document.getElementById("dy-hours").value);
  const content = document.getElementById("dy-content").value;

  const newDiary = {
    id: `d${MOCK_DB.diaries.length + 1}`,
    date,
    projectId,
    hours,
    content
  };

  MOCK_DB.diaries.push(newDiary);
  closeModal("modal-create-diary");
  document.getElementById("diary-form").reset();

  alert("업무일지가 성공적으로 등록되었습니다.");

  if (activeSubView === "diary") renderDiaryWeekView();
}


// --- ⑩ APP INITIALIZATION ON LOAD ---
window.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize DB states
  initTimesheets();

  // 2. Start public animations
  startHeroSlider();

  // 3. Set default view to Public Homepage
  switchMainView("public");

  // 4. Bind keyboard shortcuts or other actions if necessary
  lucide.createIcons();
});
