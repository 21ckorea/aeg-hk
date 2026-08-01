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
