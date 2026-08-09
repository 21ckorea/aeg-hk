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
  window.setTimeout(() => { void window.renderGoogleButton?.(); }, 0);
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
  MOCK_DB.currentUser.accessRole = user.role || 'staff';
  const position = [user.jobRank, user.jobTitle].filter(Boolean).join(' / ');
  MOCK_DB.currentUser.role = user.role === 'admin' ? (position || '관리자') : (position || '직원');
  MOCK_DB.currentUser.avatar = user.avatar || './assets/profile-placeholder.svg';
  const avatarImage = document.getElementById('current-user-avatar');
  if (avatarImage) {
    avatarImage.onerror = () => {
      avatarImage.onerror = null;
      avatarImage.src = './assets/profile-placeholder.svg';
    };
    avatarImage.src = profileAvatarSource(MOCK_DB.currentUser.avatar);
  }

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
    const label = role === 'admin' ? '관리자' : role === 'manager' ? '과장' : '직원';
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
  const projectMenu = document.getElementById('menu-projects');
  if (projectMenu) projectMenu.style.display = role === 'admin' ? 'flex' : 'none';

  const blueprintButton = document.getElementById('btn-view-blueprint');
  if (blueprintButton) blueprintButton.hidden = role !== 'admin';
  if (role !== 'admin') {
    const blueprintDrawer = document.getElementById('blueprint-drawer');
    if (blueprintDrawer) blueprintDrawer.classList.remove('active');
  }
}

async function initializeAuth() {
  const session = await window.getGoogleSession?.();
  if (session?.user) {
    let user = { ...session.user, avatar: session.user.picture };
    try {
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.user) {
        user = { ...user, name: data.user.name, jobRank: data.user.job_rank, jobTitle: data.user.job_title, role: data.user.role, avatar: data.user.avatar_url || user.avatar };
      }
    } catch (_) {}
    applyAuthenticatedUser(user, { navigateToIntranet: false });
  }
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

async function requestIntranetAccess() {
  if (isAuthenticated) {
    // 자동 로그인 직후에는 DB 데이터를 다 받기 전 빈 인트라넷 화면을 열지 않는다.
    await window.workflowHydrationPromise;
    switchMainView('intranet');
    return;
  }
  openAuthModal('login');
}

async function openProfileModal() {
  const response = await fetch('/api/profile', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) return alert(data.error || '프로필을 불러올 수 없습니다.');
  document.getElementById('profile-name').value = data.user.name || '';
  document.getElementById('profile-rank').value = data.user.job_rank || '';
  document.getElementById('profile-title').value = data.user.job_title || '';
  const savedAvatar = data.user.avatar_url || '';
  window.profileAvatarPath = savedAvatar.startsWith('profile/') ? savedAvatar : null;
  const preview = document.getElementById('profile-avatar-preview');
  if (preview) preview.src = profileAvatarSource(savedAvatar || MOCK_DB.currentUser.avatar);
  const input = document.getElementById('profile-avatar-input');
  if (input) input.value = '';
  const status = document.getElementById('profile-upload-status');
  if (status) status.textContent = '';
  syncProfileNamePreview();
  document.getElementById('modal-profile')?.classList.add('active');
  lucide.createIcons();
}

let profilePreviewObjectUrl = '';

function profileAvatarSource(avatar) {
  if (String(avatar || '').startsWith('profile/')) return `/api/attachments?profile=1&v=${Date.now()}`;
  return avatar || './assets/profile-placeholder.svg';
}

function syncProfileNamePreview() {
  const name = document.getElementById('profile-name')?.value.trim();
  const previewName = document.getElementById('profile-preview-name');
  if (previewName) previewName.textContent = name || '이름을 입력해 주세요';
}

function handleProfileAvatarSelection(event) {
  const file = event.target.files?.[0];
  const status = document.getElementById('profile-upload-status');
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    event.target.value = '';
    if (status) status.textContent = 'JPG, PNG, WEBP, GIF 이미지만 선택할 수 있습니다.';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = '';
    if (status) status.textContent = '프로필 사진은 5MB 이하만 업로드할 수 있습니다.';
    return;
  }
  if (profilePreviewObjectUrl) URL.revokeObjectURL(profilePreviewObjectUrl);
  profilePreviewObjectUrl = URL.createObjectURL(file);
  const preview = document.getElementById('profile-avatar-preview');
  if (preview) preview.src = profilePreviewObjectUrl;
  if (status) status.textContent = `${file.name} · 저장하면 프로필 사진이 변경됩니다.`;
}

async function saveProfile(event) {
  event.preventDefault();
  const saveButton = event.submitter;
  const photoInput = document.getElementById('profile-avatar-input');
  const status = document.getElementById('profile-upload-status');
  let avatarPath = window.profileAvatarPath;
  try {
    if (photoInput?.files?.[0]) {
      if (typeof window.uploadProfileBlob !== 'function') throw new Error('사진 업로드 기능을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      if (saveButton) saveButton.disabled = true;
      if (status) status.textContent = '프로필 사진을 업로드하고 있습니다…';
      const uploaded = await window.uploadProfileBlob(MOCK_DB.currentUser.id, photoInput.files[0], ({ percentage }) => {
        if (status) status.textContent = `프로필 사진 업로드 중… ${Math.round(percentage || 0)}%`;
      });
      avatarPath = uploaded.pathname;
    }
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('profile-name').value,
        jobRank: document.getElementById('profile-rank').value,
        jobTitle: document.getElementById('profile-title').value,
        ...(avatarPath ? { avatarUrl: avatarPath } : {})
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '프로필 저장에 실패했습니다.');
  applyAuthenticatedUser({
    id: data.user.id, email: data.user.email, name: data.user.name,
    jobRank: data.user.job_rank, jobTitle: data.user.job_title,
    role: data.user.role, avatar: data.user.avatar_url
  }, { navigateToIntranet: false });
    if (profilePreviewObjectUrl) URL.revokeObjectURL(profilePreviewObjectUrl);
    profilePreviewObjectUrl = '';
  closeModal('modal-profile');
  } catch (error) {
    if (status) status.textContent = error.message || '프로필 저장에 실패했습니다.';
    alert(error.message || '프로필 저장에 실패했습니다.');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}
