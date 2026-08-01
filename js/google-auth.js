window.googleAuthReady = (async () => {
  const response = await fetch('/api/auth-config', { cache: 'no-store' });
  if (!response.ok) return null;
  const { clientId } = await response.json();
  await new Promise(resolve => {
    const timer = setInterval(() => { if (window.google?.accounts?.id) { clearInterval(timer); resolve(); } }, 50);
  });
  window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
  return true;
})().catch(() => null);

window.renderGoogleButton = async () => {
  if (!await window.googleAuthReady) return;
  const target = document.getElementById('google-signin-button');
  if (!target) return;
  target.replaceChildren();
  const width = Math.max(220, Math.min(320, target.getBoundingClientRect().width || 320));
  window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: Math.floor(width), text: 'continue_with' });
};

window.addEventListener('DOMContentLoaded', () => { void window.renderGoogleButton(); });

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
