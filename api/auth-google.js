const { OAuth2Client } = require('google-auth-library');
const { COOKIE_NAME, createSessionToken } = require('./_session');

function getBody(request) {
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return request.body || {};
}

module.exports = async (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured.');
    const { credential } = getBody(request);
    if (!credential) return response.status(400).json({ error: 'Google credential is required.' });
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    const allowed = (process.env.INTRANET_ALLOWED_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
    if (!email || !payload.email_verified || !allowed.includes(email)) return response.status(403).json({ error: 'This Google account is not approved for the intranet.' });
    const token = createSessionToken({ id: payload.sub, email, name: payload.name || email, picture: payload.picture || '' });
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
    response.status(200).json({ user: { id: payload.sub, email, name: payload.name || email, picture: payload.picture || '' } });
  } catch (error) {
    console.error('Google authentication failed:', error);
    response.status(401).json({ error: 'Google authentication could not be verified.' });
  }
};
