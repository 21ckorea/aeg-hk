let authMode = 'login';
let isAuthenticated = false;
let MOCK_DB = createDefaultAppState();

function createDefaultAppState() {
  const defaultUser = {
    id: 'emp01',
    name: '홍길동',
    accessRole: 'staff',
    role: 'AA부서 / 과장',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
  };

  return {
    currentUser: { ...defaultUser },
    projects: [],
    wbsTasks: [],
    assignedProjects: [],
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
    wbsTasks: Array.isArray(state?.wbsTasks) ? state.wbsTasks : [],
    assignedProjects: Array.isArray(state?.assignedProjects) ? state.assignedProjects : [],
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

function saveAppState() {
  // UI rendering state is refreshed from the relational Neon APIs after login.
  // There is intentionally no localStorage or legacy app-state persistence.
}

function ensureStateShape() {
  if (!MOCK_DB.projects) MOCK_DB.projects = [];
  if (!MOCK_DB.wbsTasks) MOCK_DB.wbsTasks = [];
  if (!MOCK_DB.assignedProjects) MOCK_DB.assignedProjects = [];
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

function clearStoredSession() {}

async function initState() {
  MOCK_DB = createDefaultAppState();
  ensureStateShape();
}

// Other modules wait for this before rendering, so a Vercel/Neon load
// cannot overwrite a screen that has already been initialized with local data.
window.appStateReady = initState();
