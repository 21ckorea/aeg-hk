const { OAuth2Client } = require('google-auth-library');
const { neon } = require('@neondatabase/serverless');
const { COOKIE_NAME, createSessionToken } = require('./_session');

function getBody(request) {
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return request.body || {};
}

function emailList(name) {
  return (process.env[name] || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
}

async function ensureUsersTable(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS public.app_users (
    id text primary key,
    email text not null unique,
    name text not null,
    department text,
    job_rank text,
    job_title text,
    role text not null default 'staff',
    status text not null default 'active',
    avatar_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`);
  await sql.query('ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS job_rank text');
}

function cleanProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const name = String(profile.name || '').trim();
  const jobRank = String(profile.jobRank || '').trim();
  const jobTitle = String(profile.jobTitle || '').trim();
  if (!name) return null;
  if (name.length > 80 || jobRank.length > 80 || jobTitle.length > 120) throw new Error('Profile fields are too long.');
  return { name, jobRank, jobTitle };
}

module.exports = async (request, response) => {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured.');
    const { credential, profile } = getBody(request);
    if (!credential) return response.status(400).json({ error: 'Google credential is required.' });
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase();
    if (!email || !payload.email_verified) return response.status(403).json({ error: 'Google 이메일 인증 정보를 확인할 수 없습니다.' });

    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
    const sql = neon(process.env.DATABASE_URL);
    await ensureUsersTable(sql);

    const configuredAdmin = emailList('INTRANET_ADMIN_EMAILS').includes(email);
    let user;
    if (profile !== undefined) {
      const submitted = cleanProfile(profile);
      if (!submitted) return response.status(400).json({ error: '이름은 필수 입력입니다.' });
      const rows = await sql.query(
        `INSERT INTO public.app_users (id, email, name, job_rank, job_title, role, status, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, job_rank = EXCLUDED.job_rank,
           job_title = EXCLUDED.job_title, avatar_url = EXCLUDED.avatar_url, updated_at = now()
         RETURNING id, email, name, job_rank, job_title, role, status, avatar_url`,
        [payload.sub, email, submitted.name, submitted.jobRank || null, submitted.jobTitle || null, configuredAdmin ? 'admin' : 'staff', configuredAdmin ? 'active' : 'inactive', payload.picture || null]
      );
      user = rows[0];
      if (!configuredAdmin && user.status !== 'active') return response.status(202).json({ pending: true, message: '회원가입이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' });
    } else {
      const rows = await sql.query(
        'SELECT id, email, name, job_rank, job_title, role, avatar_url FROM public.app_users WHERE email = $1 AND status = $2',
        [email, 'active']
      );
      user = rows[0];
      if (!user) return response.status(409).json({ code: 'PROFILE_REQUIRED', error: '먼저 회원가입에서 이름을 입력한 후 Google 계정을 연결해 주세요.' });
    }
    if (!configuredAdmin && user.status !== 'active') return response.status(403).json({ code: 'PENDING_APPROVAL', error: '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.' });
    if (configuredAdmin && user.role !== 'admin') {
      const rows = await sql.query('UPDATE public.app_users SET role = $2, updated_at = now() WHERE id = $1 RETURNING id, email, name, job_rank, job_title, role, avatar_url', [user.id, 'admin']);
      user = rows[0] || user;
    }
    const role = configuredAdmin ? 'admin' : user.role;
    const sessionUser = { id: user.id, email, name: user.name, picture: user.avatar_url || payload.picture || '', jobRank: user.job_rank || '', jobTitle: user.job_title || '', role };
    const token = createSessionToken(sessionUser);
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
    response.status(200).json({ user: sessionUser });
  } catch (error) {
    console.error('Google authentication failed:', error);
    response.status(401).json({ error: 'Google authentication could not be verified.' });
  }
};
