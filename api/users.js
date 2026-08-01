const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

const ROLES = new Set(['staff', 'manager', 'admin']);
const STATUSES = new Set(['active', 'inactive']);

function getBody(request) {
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return request.body || {};
}

function send(response, status, body) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(status).json(body);
}

async function requireAdmin(request) {
  const user = await requireSession(request);
  if (user.role !== 'admin') {
    const error = new Error('Administrator access is required.');
    error.status = 403;
    throw error;
  }
  return user;
}

module.exports = async (request, response) => {
  if (!process.env.DATABASE_URL) return send(response, 503, { error: 'DATABASE_URL is not configured.' });
  try {
    const administrator = await requireAdmin(request);
    const sql = neon(process.env.DATABASE_URL);
    if (request.method === 'GET') {
      const users = await sql.query('SELECT id, email, name, job_rank, job_title, role, status, created_at FROM public.app_users ORDER BY created_at ASC');
      return send(response, 200, { users });
    }
    if (request.method === 'PATCH') {
      const { id, role, status } = getBody(request);
      if (!id || (!ROLES.has(role) && !STATUSES.has(status))) return send(response, 400, { error: '변경할 유효한 권한 또는 상태가 필요합니다.' });
      if (id === administrator.id && (role && role !== 'admin' || status === 'inactive')) {
        return send(response, 400, { error: '현재 로그인한 관리자의 권한을 해제하거나 비활성화할 수 없습니다.' });
      }
      const rows = await sql.query(
        `UPDATE public.app_users
         SET role = COALESCE($2, role), status = COALESCE($3, status), updated_at = now()
         WHERE id = $1 RETURNING id, email, name, job_rank, job_title, role, status`,
        [id, ROLES.has(role) ? role : null, STATUSES.has(status) ? status : null]
      );
      if (!rows[0]) return send(response, 404, { error: '사용자를 찾을 수 없습니다.' });
      return send(response, 200, { user: rows[0] });
    }
    return send(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('User administration request failed:', error);
    return send(response, error.status || 500, { error: error.status ? error.message : '사용자 관리 요청에 실패했습니다.' });
  }
};
