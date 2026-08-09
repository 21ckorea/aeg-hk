const GOOGLE_LIBRARY_TIMEOUT = 7000;
// OAuth Client ID는 공개 식별자이므로, 인증 설정 API를 일시적으로 읽지 못해도
// 로그인 버튼 자체는 계속 표시할 수 있도록 안전한 클라이언트 측 대체값을 둔다.
const GOOGLE_CLIENT_ID_FALLBACK = '992638904289-8garnu91ps371qpcoa23gv0skk4fppkv.apps.googleusercontent.com';

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
  let clientId = GOOGLE_CLIENT_ID_FALLBACK;
  try {
    const response = await fetch('/api/auth-config', { cache: 'no-store' });
    if (response.ok) {
      const config = await response.json();
      clientId = config.clientId || GOOGLE_CLIENT_ID_FALLBACK;
    }
  } catch {
    // 네트워크/서비스 워커의 일시 오류는 공개 OAuth 식별자로 복구한다.
  }

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
    // Google 라이브러리가 예외 없이 끝나도 iframe을 만들지 못하는 경우가 있다.
    // 빈 영역을 남기지 말고 사용자가 바로 재시도할 수 있게 안내한다.
    window.setTimeout(() => {
      if (!target.querySelector('iframe')) {
        showGoogleButtonError('Google 로그인 버튼을 표시하지 못했습니다. 다시 불러와 주세요.');
      }
    }, 1000);
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
  setAuthMessage(isSignup ? '가입 요청을 보내고 있습니다…' : '로그인 정보를 확인하고 있습니다…', 'info');
  try {
    const result = await fetch('/api/auth-google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential, profile }) });
    const data = await result.json().catch(() => ({}));
    if (data.pending) return setAuthMessage('가입 요청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.', 'success');
    if (data.code === 'PROFILE_REQUIRED') return switchAuthMode('signup'), setAuthMessage(data.error, 'info');
    if (!result.ok) return setAuthMessage(data.error || '승인되지 않은 계정입니다.', 'error');
    // 로그인 성공 직후 기본 상태를 먼저 보여주면 데이터가 없는 화면이 잠깐 나타난다.
    // 인증 창 안에서 데이터를 준비한 뒤 완성된 인트라넷 화면으로 전환한다.
    applyAuthenticatedUser({ ...data.user, avatar: data.user.picture }, { navigateToIntranet: false });
    setAuthMessage('업무 데이터를 불러오는 중입니다…', 'info');
    window.workflowHydrationPromise = null;
    await window.ensureWorkflowHydrated?.();
    hideAuthModal();
    switchMainView('intranet');
  } catch (_) {
    setAuthMessage('가입 요청을 보내지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.', 'error');
  }
}

window.getGoogleSession = async () => {
  try { return await (await fetch('/api/auth-session', { cache: 'no-store' })).json(); } catch { return null; }
};
