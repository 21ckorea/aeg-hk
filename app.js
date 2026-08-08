/* ==================== APP.JS ==================== */

// --- GLOBAL APP STATE (persisted locally, no hard-coded demo rows) ---
const APP_STATE_STORAGE_KEY = 'aeg-hk-app-state-v2';
const AUTH_USERS_KEY = 'aeg-hk-auth-users';
const AUTH_SESSION_KEY = 'aeg-hk-auth-session';
let authMode = 'login';
let isAuthenticated = false;

function createDefaultAppState() {
  const defaultUser = {
    id: 'emp01',
    name: '홍길동',
    role: 'AA부서 / 과장',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
  };

  return {
    currentUser: { ...defaultUser },
    projects: [],
    employees: [
      { id: 'emp01', name: '홍길동', dept: 'AA부서', rank: '과장', status: 'normal', avatar: 'H', joinDate: '오늘 등록' }
    ],
    timesheets: {},
    approvals: [],
    notices: [],
    projectsSummary: [],
    diaries: [],
    attendance: {
      status: 'out',
      checkInTime: null,
      checkOutTime: null,
      log: []
    }
  };
}

function normalizeAppState(state) {
  const base = createDefaultAppState();
  const normalized = {
    ...base,
    ...state,
    currentUser: { ...base.currentUser, ...(state?.currentUser || {}) },
    projects: Array.isArray(state?.projects) ? state.projects : [],
    employees: Array.isArray(state?.employees) && state.employees.length > 0 ? state.employees : [
      { id: 'emp01', name: '홍길동', dept: 'AA부서', rank: '과장', status: 'normal', avatar: 'H', joinDate: '오늘 등록' }
    ],
    timesheets: state?.timesheets && typeof state.timesheets === 'object' ? state.timesheets : {},
    approvals: Array.isArray(state?.approvals) ? state.approvals : [],
    notices: Array.isArray(state?.notices) ? state.notices : [],
    projectsSummary: Array.isArray(state?.projectsSummary) ? state.projectsSummary : [],
    diaries: Array.isArray(state?.diaries) ? state.diaries : [],
    attendance: { ...base.attendance, ...(state?.attendance || {}) }
  };

  if (!normalized.currentUser.id) normalized.currentUser.id = normalized.employees[0].id;
  if (!normalized.currentUser.name) normalized.currentUser.name = normalized.employees[0].name;

  return normalized;
}

function loadAppState() {
  try {
    const stored = localStorage.getItem(APP_STATE_STORAGE_KEY);
    return normalizeAppState(stored ? JSON.parse(stored) : null);
  } catch (error) {
    return createDefaultAppState();
  }
}

function saveAppState() {
  try {
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(MOCK_DB));
  } catch (error) {
    console.warn('State save skipped', error);
  }
}

function ensureStateShape() {
  if (!MOCK_DB.projects) MOCK_DB.projects = [];
  if (!MOCK_DB.approvals) MOCK_DB.approvals = [];
  if (!MOCK_DB.notices) MOCK_DB.notices = [];
  if (!MOCK_DB.projectsSummary) MOCK_DB.projectsSummary = [];
  if (!MOCK_DB.diaries) MOCK_DB.diaries = [];
  if (!MOCK_DB.timesheets) MOCK_DB.timesheets = {};
  if (!MOCK_DB.attendance) MOCK_DB.attendance = { status: 'out', checkInTime: null, checkOutTime: null, log: [] };
  if (!MOCK_DB.employees || MOCK_DB.employees.length === 0) {
    MOCK_DB.employees = [
      { id: 'emp01', name: MOCK_DB.currentUser?.name || '홍길동', dept: 'AA부서', rank: '과장', status: 'normal', avatar: 'H', joinDate: '오늘 등록' }
    ];
  }
  if (!MOCK_DB.currentUser?.id) {
    MOCK_DB.currentUser = { ...MOCK_DB.employees[0], role: 'AA부서 / 과장' };
  }
}

let MOCK_DB = loadAppState();
ensureStateShape();

// --- AUTH STATE & SESSION MANAGEMENT ---

function getStoredUsers() {
  try {
    const stored = localStorage.getItem(AUTH_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

function saveStoredUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getStoredSession() {
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function saveStoredSession(user) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function ensureDemoAccounts() {
  const users = getStoredUsers();
  const hasAdmin = users.some(user => user.email === 'ingyo98@gmail.com');
  if (!hasAdmin) {
    users.push({
      id: 'admin-ingyo',
      name: '관리자',
      email: 'ingyo98@gmail.com',
      password: 'Admin1234!',
      role: 'admin'
    });
  }
  saveStoredUsers(users);
}

function setAuthMessage(message, type = 'info') {
  const box = document.getElementById('auth-message');
  if (!box) return;
  box.textContent = message;
  box.className = `auth-message ${type}`;
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  const backdrop = document.getElementById('auth-backdrop');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');

  if (backdrop) backdrop.classList.add('active');
  if (loginTab) loginTab.classList.toggle('active', mode === 'login');
  if (signupTab) signupTab.classList.toggle('active', mode === 'signup');
  if (loginForm) loginForm.classList.toggle('active', mode === 'login');
  if (signupForm) signupForm.classList.toggle('active', mode === 'signup');
  setAuthMessage('');
}

function hideAuthModal() {
  const backdrop = document.getElementById('auth-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

function switchAuthMode(mode) {
  authMode = mode;
  openAuthModal(mode);
}

function applyAuthenticatedUser(user) {
  isAuthenticated = true;
  MOCK_DB.currentUser.id = user.id || user.email;
  MOCK_DB.currentUser.name = user.name;
  MOCK_DB.currentUser.role = user.role === 'admin'
    ? '인사팀 / 관리자'
    : user.role === 'manager'
      ? 'AA부서 / 과장'
      : '설계부서 / 사원';
  MOCK_DB.currentUser.avatar = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';

  if (!MOCK_DB.employees.some(emp => emp.id === MOCK_DB.currentUser.id)) {
    MOCK_DB.employees.unshift({
      id: MOCK_DB.currentUser.id,
      name: MOCK_DB.currentUser.name,
      dept: 'AA부서',
      rank: '과장',
      status: 'normal',
      avatar: MOCK_DB.currentUser.name.charAt(0),
      joinDate: '오늘 등록'
    });
  }

  saveAppState();

  const userName = document.getElementById('current-user-name');
  const userRole = document.getElementById('current-user-role');
  if (userName) userName.textContent = user.name;
  if (userRole) userRole.textContent = MOCK_DB.currentUser.role;

  updateRoleAwareUI(user.role || 'staff');
  hideAuthModal();
  switchMainView('intranet');
  if (activeSubView === 'dashboard') {
    renderDashboardApprovals();
  }
}

function updateRoleAwareUI(role) {
  const roleBadge = document.getElementById('role-badge');
  if (roleBadge) {
    const label = role === 'admin' ? '관리자' : role === 'manager' ? '과장' : '사원';
    roleBadge.textContent = label;
  }

  const shield = document.getElementById('role-shield');
  if (shield) {
    shield.textContent = role === 'admin' ? '관리권한' : role === 'manager' ? 'PM 권한' : '업무권한';
  }

  const adminMenu = document.getElementById('menu-admin');
  if (adminMenu) {
    adminMenu.style.display = role === 'admin' ? 'flex' : 'none';
  }
}

function initializeAuth() {
  ensureDemoAccounts();
  const sessionUser = getStoredSession();
  if (sessionUser) {
    applyAuthenticatedUser(sessionUser);
    return;
  }

  openAuthModal('login');
}

function handleEmailLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const users = getStoredUsers();
  const foundUser = users.find(user => user.email === email && user.password === password);

  if (!foundUser) {
    setAuthMessage('이메일 또는 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  saveStoredSession(foundUser);
  setAuthMessage('로그인되었습니다. 인트라넷으로 이동합니다.', 'success');
  applyAuthenticatedUser(foundUser);
}

function handleEmailSignup(event) {
  event.preventDefault();
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  if (!name || !email || !password) {
    setAuthMessage('이름, 이메일, 비밀번호를 모두 입력해주세요.', 'error');
    return;
  }

  const users = getStoredUsers();
  if (users.some(user => user.email === email)) {
    setAuthMessage('이미 가입된 이메일입니다. 로그인해 주세요.', 'error');
    return;
  }

  const newUser = {
    id: `user-${Date.now()}`,
    name,
    email,
    password,
    role: 'staff'
  };

  users.push(newUser);
  saveStoredUsers(users);
  saveStoredSession(newUser);
  setAuthMessage('회원가입이 완료되었습니다. 바로 인트라넷에 진입합니다.', 'success');
  applyAuthenticatedUser(newUser);
}

function handleGoogleSignIn() {
  setAuthMessage('회원가입된 계정으로만 로그인할 수 있습니다. 관리자 계정은 ingyo98@gmail.com / Admin1234! 입니다.', 'info');
}

function logout() {
  clearStoredSession();
  isAuthenticated = false;
  switchMainView('public');
  openAuthModal('login');
}

function requestIntranetAccess() {
  if (isAuthenticated) {
    switchMainView('intranet');
    return;
  }
  openAuthModal('login');
}

// --- INITIALIZE TIMESHEETS DATABASE ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

function initTimesheets() {
  const daysInMonth = 30;
  ensureStateShape();

  MOCK_DB.employees.forEach(emp => {
    if (!MOCK_DB.timesheets[emp.id]) {
      MOCK_DB.timesheets[emp.id] = {};
    }

    MOCK_DB.projects.forEach(p => {
      if (!MOCK_DB.timesheets[emp.id][p.id]) {
        MOCK_DB.timesheets[emp.id][p.id] = new Array(daysInMonth).fill(0);
      }
    });

    if (!MOCK_DB.timesheets[emp.id]["vacation"]) {
      MOCK_DB.timesheets[emp.id]["vacation"] = new Array(daysInMonth).fill(0);
    }
  });

  saveAppState();
}


// --- CORE NAV ROUTER & VIEW CONTROLLER ---
function switchMainView(viewType) {
  const pubView = document.getElementById("view-public");
  const intraView = document.getElementById("view-intranet");
  const btnPub = document.getElementById("btn-toggle-public");
  const btnIntra = document.getElementById("btn-toggle-intranet");

  if (viewType === "intranet" && !isAuthenticated) {
    openAuthModal('login');
    return;
  }

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
    timesheet: "투입시간 관리",
    manpower: "인력 투입 분석",
    approval: "전자결재 문서함",
    attendance: "사내 근태 관리",
    admin: "관리자 설정",
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
  } else if (subViewId === "admin") {
    renderAdminPanel();
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

function switchUserRole(role) {
  const userName = document.getElementById("current-user-name");
  const userRole = document.getElementById("current-user-role");
  const roleLabel = document.getElementById("role-select");

  if (!userName || !userRole || !roleLabel) return;

  if (role === "manager") {
    MOCK_DB.currentUser.name = "홍길동";
    MOCK_DB.currentUser.role = "AA부서 / 과장";
    userName.textContent = "홍길동";
    userRole.textContent = "AA부서 / 과장";
    roleLabel.value = "manager";
  } else if (role === "staff") {
    MOCK_DB.currentUser.name = "김철수";
    MOCK_DB.currentUser.role = "설계부서 / 사원";
    userName.textContent = "김철수";
    userRole.textContent = "설계부서 / 사원";
    roleLabel.value = "staff";
  } else if (role === "admin") {
    MOCK_DB.currentUser.name = "박민서";
    MOCK_DB.currentUser.role = "인사팀 / 관리자";
    userName.textContent = "박민서";
    userRole.textContent = "인사팀 / 관리자";
    roleLabel.value = "admin";
  }

  saveAppState();

  if (activeSubView === "approval") {
    renderApprovalsTable();
  }
  if (activeSubView === "dashboard") {
    renderDashboardApprovals();
  }
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

  const daysInMonth = 30;
  const ts = MOCK_DB.timesheets["emp01"] || {};
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
    const dayOfWeek = (d - 1) % 7;
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
    headHtml += `<th class="day-col day-header ${isWeekend ? 'weekend' : ''}">${d}</th>`;
  }
  headHtml += `</tr></thead>`;

  let bodyHtml = `<tbody>`;
  let activeProjects = MOCK_DB.projects.filter(p => p.active);

  if (activeProjects.length === 0) {
    bodyHtml += `<tr><td colspan="${daysInMonth + 3}" style="text-align:center; padding:28px; color:var(--text-muted);">프로젝트가 아직 없습니다. 아래에서 새 프로젝트를 등록해 주세요.</td></tr>`;
  } else {
    activeProjects.forEach(p => {
      bodyHtml += `<tr>`;
      bodyHtml += `<td><strong>${p.name}</strong><br><span style="font-size:10px; color:#64748b;">${p.role}</span></td>`;

      let projTotal = 0;
      for (let d = 0; d < daysInMonth; d++) {
        const dayOfWeek = d % 7;
        const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
        const val = ts[p.id]?.[d] || 0;
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
  }

  bodyHtml += `<tr>`;
  bodyHtml += `<td><strong>개인휴가 행</strong><br><span style="font-size:10px; color:#64748b;">연차/반차 반출</span></td>`;
  let vacTotal = 0;
  for (let d = 0; d < daysInMonth; d++) {
    const dayOfWeek = d % 7;
    const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
    const val = ts["vacation"]?.[d] || 0;
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

function createProjectFromPrompt() {
  const name = window.prompt('새 프로젝트명을 입력해 주세요.', '신규 프로젝트');
  if (!name) return;

  const role = window.prompt('담당 역할을 입력해 주세요.', '설계지원');
  const newProject = {
    id: `p${Date.now()}`,
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
    closeModal("modal-add-project");
    initTimesheets();
    saveAppState();
    renderTimesheet();
  }
}

function saveTimesheet() {
  saveAppState();
  alert("타임시트 진행 내역이 로컬 저장소에 임시저장되었습니다.");
}

function submitTimesheet() {
  let errorFound = false;
  for (let d = 0; d < 30; d++) {
    if (getDayTotal("emp01", d) > 8) {
      errorFound = true;
      break;
    }
  }

  let grandTotal = 0;
  for (let d = 0; d < 30; d++) {
    grandTotal += getDayTotal("emp01", d);
  }

  saveAppState();

  if (errorFound) {
    alert("⚠️ 입력오류: 하루 최대 8시간을 초과하여 배분된 날짜가 있습니다. 수정 후 제출해주세요.");
  } else if (grandTotal > 176) {
    alert(`⚠️ 입력오류: 1달 총 투입시간 합계가 1 M/M (176시간)을 초과할 수 없습니다. 현재 투입합계: ${grandTotal}H (${(grandTotal / 176).toFixed(3)} M/M)`);
  } else {
    alert("✅ 제출성공: 타임시트가 저장되고 마감 처리되었습니다.");
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

function switchApprovalTab(tabId, event) {
  activeApprovalTab = tabId;
  const tabBtns = document.querySelectorAll(".tab-buttons .tab-btn");
  tabBtns.forEach(btn => btn.classList.remove("active"));

  if (event?.currentTarget) {
    event.currentTarget.classList.add("active");
  }
  renderApprovalsTable();
}

function renderApprovalsTable() {
  const tbody = document.getElementById("approval-list-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  let filtered = MOCK_DB.approvals;
  if (activeApprovalTab === "waiting") {
    filtered = MOCK_DB.approvals.filter(a => a.status === "waiting");
  } else if (activeApprovalTab === "sent") {
    filtered = MOCK_DB.approvals.filter(a => a.drafter === MOCK_DB.currentUser.name);
  } else if (activeApprovalTab === "completed") {
    filtered = MOCK_DB.approvals.filter(a => a.status === "approved" || a.status === "rejected");
  }

  const pendingCount = MOCK_DB.approvals.filter(a => a.status === "waiting").length;
  const pendingBadge = document.getElementById("pending-approval-count");
  if (pendingBadge) pendingBadge.textContent = pendingCount;
  const dashCount = document.getElementById("dashboard-pending-approvals");
  if (dashCount) dashCount.textContent = `${pendingCount}건`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">결재 문서가 아직 없습니다. 새 문서를 작성해 주세요.</td></tr>`;
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
    saveAppState();
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
    id: `APP-${Date.now()}`,
    type,
    title,
    drafter: MOCK_DB.currentUser.name,
    date: new Date().toISOString().split('T')[0],
    status: "waiting",
    content
  };

  MOCK_DB.approvals.unshift(newAp);
  saveAppState();
  closeModal("modal-create-approval");
  document.getElementById("approval-form").reset();

  alert("기안이 완료되어 상신되었습니다.");

  if (activeSubView === "approval") renderApprovalsTable();
  renderDashboardApprovals();
}


// --- ⑦ DASHBOARD PORTLET RENDERER ---
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
  const container = document.getElementById("dashboard-approvals-container");
  if (!container) return;

  container.innerHTML = "";
  const pending = MOCK_DB.approvals.filter(a => a.status === "waiting");

  if (pending.length === 0) {
    container.innerHTML = `<p style="padding:30px; text-align:center; font-size:13px; color:var(--text-muted);">대기 중인 결재가 없습니다.</p>`;
  } else {
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

function submitNoticeForm(e) {
  e.preventDefault();
  const title = document.getElementById('notice-title').value.trim();
  const category = document.getElementById('notice-category').value;
  const content = document.getElementById('notice-content').value.trim();

  if (!title || !content) return;

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


// --- ⑧ ATTENDANCE CLOCK SIMULATOR ---
function performCheckIn() {
  const now = new Date();
  MOCK_DB.attendance.status = "in";
  MOCK_DB.attendance.checkInTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  MOCK_DB.attendance.checkOutTime = null;
  saveAppState();

  alert(`출근 등록이 완료되었습니다. (등록시간: ${MOCK_DB.attendance.checkInTime})`);

  updateAttendanceUI();
  renderDashboardApprovals();
}

function performCheckOut() {
  const now = new Date();
  MOCK_DB.attendance.status = "out";
  MOCK_DB.attendance.checkOutTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  MOCK_DB.attendance.log.push({
    date: now.toLocaleDateString("ko-KR"),
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

  const logContainer = document.getElementById("attendance-log-today");
  if (logContainer) {
    if (MOCK_DB.attendance.checkInTime) {
      logContainer.innerHTML = `
        <div style="font-size:13px; color:var(--text-muted); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
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

function renderAdminPanel() {
  const countEl = document.getElementById('admin-user-count');
  const approvalEl = document.getElementById('admin-approval-count');
  const listEl = document.getElementById('admin-user-list');

  if (!countEl || !approvalEl || !listEl) return;

  const users = getStoredUsers();
  countEl.textContent = `${users.length}명`;
  approvalEl.textContent = `${MOCK_DB.approvals.filter(item => item.status === 'waiting').length}건`;

  listEl.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    const roleLabel = user.role === 'admin' ? '관리자' : user.role === 'manager' ? '과장' : '사원';
    const statusLabel = user.email === 'ingyo98@gmail.com' ? '활성' : '승인됨';
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${roleLabel}</td>
      <td>${statusLabel}</td>
    `;
    listEl.appendChild(row);
  });
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
    id: `d${Date.now()}`,
    date,
    projectId,
    hours,
    content
  };

  MOCK_DB.diaries.push(newDiary);
  saveAppState();
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

  // 3. Initialize authentication flow
  initializeAuth();

  // 4. Set default view to Public Homepage
  switchMainView("public");

  // 5. Bind keyboard shortcuts or other actions if necessary
  lucide.createIcons();
});
