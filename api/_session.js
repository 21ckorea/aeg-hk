const crypto = require('crypto');

const COOKIE_NAME = 'aeg_hk_session';

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('APP_SESSION_SECRET must be at least 32 characters.');
  return Buffer.from(secret, 'utf8');
}

function readCookie(request, name) {
  const cookies = request.headers?.cookie || '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getSession(request) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const payload = verifySessionToken(token);
  return payload ? { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture } : null;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify({ sub: user.id, email: user.email, name: user.name, picture: user.picture, iat: now, exp: now + 28800 }));
  const value = `${header}.${payload}`;
  return `${value}.${sign(value)}`;
}

function verifySessionToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    const expected = Buffer.from(sign(`${header}.${payload}`));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.sub || !decoded.email || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
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

module.exports = { COOKIE_NAME, createSessionToken, getSession, getSessionSecret, requireSession };
