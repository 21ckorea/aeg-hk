let authMode = 'login';
let isAuthenticated = false;
let MOCK_DB = createDefaultAppState();

function createDefaultAppState() {
  const defaultUser = {
    id: '',
    name: '',
    accessRole: 'staff',
    role: '',
    avatar: './assets/profile-placeholder.svg'
  };

  return {
    currentUser: { ...defaultUser },
    projects: [],
    wbsTasks: [],
    assignedProjects: [],
    employees: [],
    timesheets: {},
    timesheetRecords: [],
    manpowerRecords: [],
    timesheetClosures: [],
    approvals: [],
    notices: [],
    projectsSummary: [],
    diaries: [],
    attendance: {
      status: 'out',
      checkInTime: null,
      checkOutTime: null,
      log: [],
      records: []
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
    employees: Array.isArray(state?.employees) ? state.employees : [],
    timesheets: state?.timesheets && typeof state.timesheets === 'object' ? state.timesheets : {},
    timesheetRecords: Array.isArray(state?.timesheetRecords) ? state.timesheetRecords : [],
    manpowerRecords: Array.isArray(state?.manpowerRecords) ? state.manpowerRecords : [],
    timesheetClosures: Array.isArray(state?.timesheetClosures) ? state.timesheetClosures : [],
    approvals: Array.isArray(state?.approvals) ? state.approvals : [],
    notices: Array.isArray(state?.notices) ? state.notices : [],
    projectsSummary: Array.isArray(state?.projectsSummary) ? state.projectsSummary : [],
    diaries: Array.isArray(state?.diaries) ? state.diaries : [],
    attendance: { ...base.attendance, ...(state?.attendance || {}) }
  };

  if (!normalized.currentUser.id && normalized.employees[0]) normalized.currentUser.id = normalized.employees[0].id;
  if (!normalized.currentUser.name && normalized.employees[0]) normalized.currentUser.name = normalized.employees[0].name;

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
  if (!MOCK_DB.timesheetRecords) MOCK_DB.timesheetRecords = [];
  if (!MOCK_DB.manpowerRecords) MOCK_DB.manpowerRecords = [];
  if (!Array.isArray(MOCK_DB.timesheetClosures)) MOCK_DB.timesheetClosures = [];
  if (!MOCK_DB.attendance) MOCK_DB.attendance = { status: 'out', checkInTime: null, checkOutTime: null, log: [], records: [] };
  if (!MOCK_DB.attendance.records) MOCK_DB.attendance.records = [];
  if (!Array.isArray(MOCK_DB.employees)) MOCK_DB.employees = [];
  if (!MOCK_DB.currentUser) MOCK_DB.currentUser = { id: '', name: '', accessRole: 'staff', role: '', avatar: './assets/profile-placeholder.svg' };
}

function clearStoredSession() {}

async function initState() {
  MOCK_DB = createDefaultAppState();
  ensureStateShape();
}

// Other modules wait for this before rendering, so a Vercel/Neon load
// cannot overwrite a screen that has already been initialized with local data.
window.appStateReady = initState();
