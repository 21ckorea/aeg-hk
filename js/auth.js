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
  const description = document.getElementById('auth-description');
  const googleNote = document.getElementById('google-auth-note');
  if (description) description.textContent = mode === 'signup'
    ? '정보를 입력한 뒤 Google 계정으로 가입을 완료하세요.'
    : '가입된 Google 계정으로 로그인하세요.';
  if (googleNote) googleNote.textContent = mode === 'signup' ? 'Google 계정으로 회원가입' : 'Google 계정으로 로그인';
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

function applyAuthenticatedUser(user, { navigateToIntranet = true } = {}) {
  isAuthenticated = true;
  MOCK_DB.currentUser.id = user.id || user.email;
  MOCK_DB.currentUser.name = user.name;
  const position = [user.jobRank, user.jobTitle].filter(Boolean).join(' / ');
  MOCK_DB.currentUser.role = user.role === 'admin' ? `관리자${position ? ` / ${position}` : ''}` : (position || '사원');
  MOCK_DB.currentUser.avatar = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80';

  if (!MOCK_DB.employees.some(emp => emp.id === MOCK_DB.currentUser.id)) {
    MOCK_DB.employees.unshift({
      id: MOCK_DB.currentUser.id,
      name: MOCK_DB.currentUser.name,
      dept: 'AA부서',
      rank: user.jobRank || '미입력',
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
  if (navigateToIntranet) {
    hideAuthModal();
    switchMainView('intranet');
    if (activeSubView === 'dashboard') {
      renderDashboardApprovals();
    }
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

  const blueprintButton = document.getElementById('btn-view-blueprint');
  if (blueprintButton) blueprintButton.hidden = role !== 'admin';
}

async function initializeAuth() {
  const session = await window.getGoogleSession?.();
  if (session?.user) applyAuthenticatedUser({ ...session.user, avatar: session.user.picture }, { navigateToIntranet: false });
}

function handleEmailLogin(event) {
  event.preventDefault();
  setAuthMessage('Google 계정으로 로그인해 주세요.', 'info');
}

function handleEmailSignup(event) {
  event.preventDefault();
  setAuthMessage('Google 계정 버튼으로 회원가입을 완료해 주세요.', 'info');
}

function logout() {
  void fetch('/api/auth-logout', { method: 'POST' });
  clearStoredSession();
  isAuthenticated = false;
  updateRoleAwareUI('staff');
  const blueprintDrawer = document.getElementById('blueprint-drawer');
  if (blueprintDrawer) blueprintDrawer.classList.remove('active');
  switchMainView('public');
  hideAuthModal();
}

function requestIntranetAccess() {
  if (isAuthenticated) {
    switchMainView('intranet');
    return;
  }
  openAuthModal('login');
}
