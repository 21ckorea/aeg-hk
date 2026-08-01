const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const user = await requireSession(request);
    if (!process.env.DATABASE_URL) return response.status(503).json({ error: 'DATABASE_URL is not configured.' });
    const sql = neon(process.env.DATABASE_URL);
    const users = await sql.query(
      `SELECT id, name, email, job_rank, job_title, role, avatar_url
       FROM public.app_users WHERE status = 'active'
       ORDER BY name ASC`
    );
    response.status(200).json({ users: user.role === 'staff' ? users.filter(item => item.id === user.id) : users });
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message || '사용자 목록을 불러오지 못했습니다.' });
  }
};
