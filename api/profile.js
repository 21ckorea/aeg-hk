const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

function body(request) {
  return typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {});
}

function clean(value, length) {
  const result = String(value || '').trim();
  if (result.length > length) throw new Error('입력값이 너무 깁니다.');
  return result;
}

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!process.env.DATABASE_URL) return response.status(503).json({ error: 'DATABASE_URL is not configured.' });
  try {
    const session = await requireSession(request);
    const sql = neon(process.env.DATABASE_URL);
    if (request.method === 'GET') {
      const rows = await sql.query('SELECT id, email, name, job_rank, job_title, role, status, avatar_url FROM public.app_users WHERE id = $1', [session.id]);
      return response.status(rows[0] ? 200 : 404).json(rows[0] ? { user: rows[0] } : { error: '사용자 정보를 찾을 수 없습니다.' });
    }
    if (request.method === 'PATCH') {
      const input = body(request);
      const name = clean(input.name, 80);
      const jobRank = clean(input.jobRank, 80);
      const jobTitle = clean(input.jobTitle, 120);
      if (!name) return response.status(400).json({ error: '이름은 필수 입력입니다.' });
      const rows = await sql.query(
        'UPDATE public.app_users SET name = $2, job_rank = $3, job_title = $4, updated_at = now() WHERE id = $1 RETURNING id, email, name, job_rank, job_title, role, status, avatar_url',
        [session.id, name, jobRank || null, jobTitle || null]
      );
      return response.status(rows[0] ? 200 : 404).json(rows[0] ? { user: rows[0] } : { error: '사용자 정보를 찾을 수 없습니다.' });
    }
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Profile request failed:', error);
    return response.status(error.status || 400).json({ error: error.status ? error.message : '프로필 저장에 실패했습니다.' });
  }
};
