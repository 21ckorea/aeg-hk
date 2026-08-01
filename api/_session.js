const { jwtVerify } = require('jose');

const COOKIE_NAME = 'aeg_hk_session';

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('APP_SESSION_SECRET must be at least 32 characters.');
  return new TextEncoder().encode(secret);
}

function readCookie(request, name) {
  const cookies = request.headers?.cookie || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getSession(request) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
  } catch {
    return null;
  }
}

async function requireSession(request) {
  const session = await getSession(request);
  if (!session) {
    const error = new Error('Authentication is required.');
    error.status = 401;
    throw error;
  }
  return session;
}

module.exports = { COOKIE_NAME, getSession, getSessionSecret, requireSession };
