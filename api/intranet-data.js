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

function body(request) {
  return typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {});
}

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function requireFields(input, fields) {
  for (const field of fields) if (!input[field]) throw new Error(`${field} is required.`);
}

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const user = await requireSession(request);
    const resource = String(request.query?.resource || '');
    const config = RESOURCES[resource];
    if (!config) return response.status(400).json({ error: 'Unknown intranet resource.' });
    if (!process.env.DATABASE_URL) return response.status(503).json({ error: 'DATABASE_URL is not configured.' });
    const sql = neon(process.env.DATABASE_URL);
    const isPrivileged = user.role === 'admin' || user.role === 'manager';
    if (request.method === 'GET') {
      const where = config.owner && !isPrivileged ? ` WHERE ${config.owner} = $1` : '';
      const rows = await sql.query(`SELECT * FROM public.${config.table}${where} ORDER BY created_at DESC`, config.owner && !isPrivileged ? [user.id] : []);
      return response.status(200).json({ resource, records: rows });
    }
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

    const input = body(request);
    let rows;
    if (resource === 'projects') {
      if (!isPrivileged) return response.status(403).json({ error: 'PM 또는 관리자만 프로젝트를 등록할 수 있습니다.' });
      requireFields(input, ['name']);
      rows = await sql.query('INSERT INTO public.projects (id, name, work_role, manager_id, started_on, ended_on) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id('project'), input.name, input.workRole || null, input.managerId || user.id, input.startedOn || null, input.endedOn || null]);
    } else if (resource === 'timesheets') {
      requireFields(input, ['workDate', 'hours']);
      rows = await sql.query('INSERT INTO public.timesheet_entries (user_id, project_id, work_date, hours, entry_type, memo) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, project_id, work_date, entry_type) DO UPDATE SET hours = EXCLUDED.hours, memo = EXCLUDED.memo, updated_at = now() RETURNING *', [user.id, input.projectId || null, input.workDate, input.hours, input.entryType || 'project', input.memo || null]);
    } else if (resource === 'attendance') {
      requireFields(input, ['workDate']);
      rows = await sql.query('INSERT INTO public.attendance_records (user_id, work_date, checked_in_at, checked_out_at) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, work_date) DO UPDATE SET checked_in_at = COALESCE(EXCLUDED.checked_in_at, attendance_records.checked_in_at), checked_out_at = COALESCE(EXCLUDED.checked_out_at, attendance_records.checked_out_at), updated_at = now() RETURNING *', [user.id, input.workDate, input.checkedInAt || null, input.checkedOutAt || null]);
    } else if (resource === 'approvals') {
      requireFields(input, ['documentType', 'title', 'content']);
      rows = await sql.query('INSERT INTO public.approval_documents (id, requester_id, document_type, title, content) VALUES ($1, $2, $3, $4, $5) RETURNING *', [id('approval'), user.id, input.documentType, input.title, input.content]);
    } else if (resource === 'notices') {
      if (!isPrivileged) return response.status(403).json({ error: 'PM 또는 관리자만 공지를 등록할 수 있습니다.' });
      requireFields(input, ['title', 'content']);
      rows = await sql.query('INSERT INTO public.notices (id, author_id, category, title, content, is_pinned) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id('notice'), user.id, input.category || '공지', input.title, input.content, Boolean(input.isPinned)]);
    } else {
      requireFields(input, ['workDate', 'hours', 'content']);
      rows = await sql.query('INSERT INTO public.diary_entries (id, user_id, project_id, work_date, hours, content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id('diary'), user.id, input.projectId || null, input.workDate, input.hours, input.content]);
    }
    return response.status(201).json({ resource, record: rows[0] });
  } catch (error) {
    console.error('Intranet data request failed:', error);
    return response.status(error.status || 500).json({ error: error.status ? error.message : '업무 데이터를 불러오지 못했습니다.' });
  }
};
