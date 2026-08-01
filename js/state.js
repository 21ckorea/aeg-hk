const APP_STATE_STORAGE_KEY = 'aeg-hk-app-state-v2';
const AUTH_USERS_KEY = 'aeg-hk-auth-users';
const AUTH_SESSION_KEY = 'aeg-hk-auth-session';

let authMode = 'login';
let isAuthenticated = false;
let MOCK_DB = createDefaultAppState();

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

  if (dbMode === 'remote') {
    void saveStateToRemote();
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

async function initState() {
  MOCK_DB = loadAppState();
  ensureStateShape();
  ensureDemoAccounts();

  const remoteLoaded = await hydrateFromRemoteIfAvailable();
  if (!remoteLoaded) {
    saveAppState();
  }
}

// Other modules wait for this before rendering, so a Vercel/Neon load
// cannot overwrite a screen that has already been initialized with local data.
window.appStateReady = initState();
