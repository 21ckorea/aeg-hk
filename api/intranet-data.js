const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

const RESOURCES = {
  projects: { table: 'projects', owner: null },
  timesheets: { table: 'timesheet_entries', owner: 'user_id' },
  attendance: { table: 'attendance_records', owner: 'user_id' },
  approvals: { table: 'approval_documents', owner: 'requester_id' },
  notices: { table: 'notices', owner: null },
  diaries: { table: 'diary_entries', owner: 'user_id' }
};

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const user = await requireSession(request);
    const resource = String(request.query?.resource || '');
    const config = RESOURCES[resource];
    if (!config) return response.status(400).json({ error: 'Unknown intranet resource.' });
    if (!process.env.DATABASE_URL) return response.status(503).json({ error: 'DATABASE_URL is not configured.' });
    const sql = neon(process.env.DATABASE_URL);
    if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
    const isPrivileged = user.role === 'admin' || user.role === 'manager';
    const where = config.owner && !isPrivileged ? ` WHERE ${config.owner} = $1` : '';
    const rows = await sql.query(`SELECT * FROM public.${config.table}${where} ORDER BY created_at DESC`, config.owner && !isPrivileged ? [user.id] : []);
    return response.status(200).json({ resource, records: rows });
  } catch (error) {
    console.error('Intranet data request failed:', error);
    return response.status(error.status || 500).json({ error: error.status ? error.message : '업무 데이터를 불러오지 못했습니다.' });
  }
};
