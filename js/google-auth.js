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

window.addEventListener('DOMContentLoaded', async () => {
  if (!await window.googleAuthReady) return;
  const target = document.getElementById('google-signin-button');
  if (target) window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
});

async function handleGoogleCredential(response) {
  const result = await fetch('/api/auth-google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: response.credential }) });
  const data = await result.json();
  if (!result.ok) return setAuthMessage(data.error || '승인되지 않은 계정입니다.', 'error');
  applyAuthenticatedUser({ ...data.user, role: 'staff', avatar: data.user.picture });
}

window.getGoogleSession = async () => {
  try { return await (await fetch('/api/auth-session', { cache: 'no-store' })).json(); } catch { return null; }
};
