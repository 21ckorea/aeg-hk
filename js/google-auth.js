const GOOGLE_LIBRARY_TIMEOUT = 7000;

function waitForGoogleLibrary(timeout = GOOGLE_LIBRARY_TIMEOUT) {
  return new Promise(resolve => {
    if (window.google?.accounts?.id) return resolve(true);
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve(true);
      }
    }, 50);
    window.setTimeout(() => {
      window.clearInterval(timer);
      resolve(Boolean(window.google?.accounts?.id));
    }, timeout);
  });
}

function showGoogleButtonError(message) {
  const target = document.getElementById('google-signin-button');
  if (!target) return;
  target.innerHTML = `<button type="button" class="google-login-retry" onclick="retryGoogleLogin()">Google 로그인 다시 불러오기</button>`;
  const help = document.getElementById('mobile-login-help');
  if (help) help.hidden = false;
  setAuthMessage(message || 'Google 로그인 버튼을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.', 'error');
}

async function initializeGoogleAuth({ retry = false } = {}) {
  const response = await fetch('/api/auth-config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Google 로그인 설정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  const { clientId } = await response.json();
  if (!clientId) throw new Error('Google 로그인 설정이 비어 있습니다. 관리자에게 문의해 주세요.');

  if (retry && !window.google?.accounts?.id) {
    const script = document.createElement('script');
    script.src = `https://accounts.google.com/gsi/client?retry=${Date.now()}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  if (!await waitForGoogleLibrary()) throw new Error('Google 로그인 서비스를 불러오지 못했습니다.');
  window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
  return true;
}

window.googleAuthReady = initializeGoogleAuth().catch(error => {
  window.googleAuthError = error;
  return null;
});

window.renderGoogleButton = async () => {
  const ready = await window.googleAuthReady;
  if (!ready) return showGoogleButtonError(window.googleAuthError?.message);
  const target = document.getElementById('google-signin-button');
  if (!target) return;
  target.replaceChildren();
  try {
    const width = Math.max(220, Math.min(320, target.getBoundingClientRect().width || 320));
    window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: Math.floor(width), text: 'continue_with' });
  } catch {
    showGoogleButtonError('Google 로그인 버튼을 표시하지 못했습니다. 다시 불러와 주세요.');
  }
};

window.retryGoogleLogin = async () => {
  const target = document.getElementById('google-signin-button');
  if (target) target.innerHTML = '<span class="google-login-loading">Google 로그인 준비 중…</span>';
  setAuthMessage('');
  window.googleAuthReady = initializeGoogleAuth({ retry: true }).catch(error => {
    window.googleAuthError = error;
    return null;
  });
  await window.renderGoogleButton();
};

window.addEventListener('DOMContentLoaded', () => { void window.renderGoogleButton(); });

function openInMobileBrowser() {
  const url = window.location.href.replace(/^https?:\/\//, '');
  if (/Android/i.test(navigator.userAgent)) {
    window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }
  window.open(window.location.href, '_blank', 'noopener');
}

async function handleGoogleCredential(response) {
  const isSignup = authMode === 'signup';
  const name = document.getElementById('signup-name')?.value.trim();
  if (isSignup && !name) return setAuthMessage('회원가입을 위해 이름을 입력해 주세요.', 'error');
  const profile = isSignup ? {
    name,
    jobRank: document.getElementById('signup-rank')?.value.trim() || '',
    jobTitle: document.getElementById('signup-title')?.value.trim() || ''
  } : undefined;
  const result = await fetch('/api/auth-google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential, profile }) });
  const data = await result.json();
  if (data.pending) return setAuthMessage(data.message, 'success');
  if (data.code === 'PROFILE_REQUIRED') return switchAuthMode('signup'), setAuthMessage(data.error, 'info');
  if (!result.ok) return setAuthMessage(data.error || '승인되지 않은 계정입니다.', 'error');
  applyAuthenticatedUser({ ...data.user, avatar: data.user.picture });
}

window.getGoogleSession = async () => {
  try { return await (await fetch('/api/auth-session', { cache: 'no-store' })).json(); } catch { return null; }
};
