const { neon } = require('@neondatabase/serverless');
const { del } = require('@vercel/blob');
const { requireSession } = require('./_session');

const RESOURCES = {
  bootstrap: { table: null, owner: null },
  companySettings: { table: 'company_settings', owner: null },
  timesheetClosures: { table: 'timesheet_month_closures', owner: 'user_id' },
  projects: { table: 'projects', owner: null },
  timesheets: { table: 'timesheet_entries', owner: 'user_id' },
  attendance: { table: 'attendance_records', owner: 'user_id' },
  approvals: { table: 'approval_documents', owner: 'requester_id' },
  notices: { table: 'notices', owner: null },
  diaries: { table: 'diary_entries', owner: 'user_id' },
  projectAssignments: { table: 'project_assignments', owner: 'user_id' },
  wbs: { table: 'project_wbs_tasks', owner: null },
  manpower: { table: 'timesheet_entries', owner: 'user_id' }
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

function dateKey(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : new Date(text).toISOString().slice(0, 10);
}

async function loadBootstrapData(sql, user, isPrivileged) {
  // 초기 진입 시 여러 API를 동시에 호출하면 한 요청의 일시적 실패가 빈 화면으로
  // 이어질 수 있다. 관련 데이터를 한 응답으로 묶어 일관된 화면 상태를 만든다.
  const own = [user.id];
  const users = await sql.query(
    `SELECT id, name, email, job_rank, job_title, role, avatar_url
     FROM public.app_users WHERE status = 'active' ${isPrivileged ? '' : 'AND id = $1'} ORDER BY name ASC`,
    isPrivileged ? [] : own
  );
  const projects = await sql.query('SELECT * FROM public.projects ORDER BY created_at DESC');
  const approvals = await sql.query(
    `SELECT * FROM public.approval_documents${isPrivileged ? '' : ' WHERE requester_id = $1'} ORDER BY created_at DESC`,
    isPrivileged ? [] : own
  );
  const notices = await sql.query('SELECT * FROM public.notices ORDER BY created_at DESC');
  const diaries = await sql.query(
    `SELECT d.*, (SELECT count(*) FROM public.diary_attachments a WHERE a.diary_id = d.id)::int AS attachment_count
     FROM public.diary_entries d${isPrivileged ? '' : ' WHERE d.user_id = $1'} ORDER BY d.created_at DESC`,
    isPrivileged ? [] : own
  );
  const attendance = await sql.query('SELECT * FROM public.attendance_records WHERE user_id = $1 ORDER BY created_at DESC', own);
  const timesheets = await sql.query('SELECT * FROM public.timesheet_entries WHERE user_id = $1 ORDER BY created_at DESC', own);
  const projectAssignments = await sql.query('SELECT project_id, planned_mm, started_on, ended_on FROM public.project_assignments WHERE user_id = $1', own);
  const wbs = await sql.query('SELECT t.*, p.name AS project_name FROM public.project_wbs_tasks t JOIN public.projects p ON p.id = t.project_id ORDER BY t.started_on ASC, t.created_at ASC');
  const manpower = await sql.query(
    `SELECT user_id, project_id, work_date, hours, entry_type FROM public.timesheet_entries${isPrivileged ? '' : ' WHERE user_id = $1'} ORDER BY work_date ASC`,
    isPrivileged ? [] : own
  );
  const timesheetClosures = await sql.query('SELECT * FROM public.timesheet_month_closures WHERE user_id = $1 ORDER BY year_month DESC', own);

  return { projects, approvals, notices, diaries, attendance, timesheets, projectAssignments, wbs, manpower, timesheetClosures, users };
}

async function ensureTimesheetClosureSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS public.timesheet_month_closures (
    user_id text NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    year_month date NOT NULL,
    is_locked boolean NOT NULL DEFAULT true,
    closed_at timestamptz,
    closed_by text REFERENCES public.app_users(id),
    reopened_at timestamptz,
    reopened_by text REFERENCES public.app_users(id),
    PRIMARY KEY (user_id, year_month)
  )`);
}

async function ensureCompanySettingsSchema(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS public.company_settings (
    id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
    name text NOT NULL, short_name text NOT NULL, intranet_name text NOT NULL,
    contact_email text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

function monthStart(value) { return `${String(value || '').slice(0, 7)}-01`; }

async function assertTimesheetMonthEditable(sql, userId, workDate) {
  const rows = await sql.query('SELECT is_locked FROM public.timesheet_month_closures WHERE user_id=$1 AND year_month=$2::date', [userId, monthStart(workDate)]);
  if (rows[0]?.is_locked) {
    const error = new Error(`${String(workDate).slice(0, 7)} 월은 마감 제출되어 수정할 수 없습니다. 프로젝트 PM 또는 관리자에게 마감 해제를 요청해 주세요.`);
    error.status = 423;
    throw error;
  }
}

async function validateDiaryProject(sql, userId, projectId, workDate) {
  if (!projectId) return null;
  const rows = await sql.query(
    'SELECT p.name, p.is_active, p.started_on, p.ended_on, pa.started_on AS assignment_started_on, pa.ended_on AS assignment_ended_on FROM public.projects p LEFT JOIN public.project_assignments pa ON pa.project_id = p.id AND pa.user_id = $1 WHERE p.id = $2',
    [userId, projectId]
  );
  const project = rows[0];
  if (!project) return '선택한 프로젝트를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.';
  const projectStart = dateKey(project.started_on);
  const projectEnd = dateKey(project.ended_on);
  const assignmentStart = dateKey(project.assignment_started_on);
  const assignmentEnd = dateKey(project.assignment_ended_on);
  if (!project.is_active) return `${project.name}: 종료 또는 비활성 프로젝트에는 업무일지를 작성할 수 없습니다.`;
  if ((projectStart && workDate < projectStart) || (projectEnd && workDate > projectEnd)) return `${project.name}: ${workDate}은 프로젝트 기간(${projectStart || '시작일 미정'} ~ ${projectEnd || '종료일 미정'}) 밖입니다. 프로젝트 기간 안의 날짜로 선택해 주세요.`;
  if (!assignmentStart) return `${project.name}: 내 투입 프로젝트에 추가되지 않았습니다. 투입시간 관리에서 먼저 프로젝트를 추가해 주세요.`;
  if (workDate < assignmentStart || (assignmentEnd && workDate > assignmentEnd)) return `${project.name}: ${workDate}은 내 프로젝트 투입 기간(${assignmentStart} ~ ${assignmentEnd || '진행 중'}) 밖입니다. 투입 기간 안의 날짜로 선택해 주세요.`;
  return null;
}

async function ensureNoticePopupSchema(sql) {
  await sql.query('ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS popup_enabled boolean NOT NULL DEFAULT false');
  await sql.query('ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS popup_start date');
  await sql.query('ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS popup_end date');
}

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const resource = String(request.query?.resource || '');
    const config = RESOURCES[resource];
    if (!config) return response.status(400).json({ error: 'Unknown intranet resource.' });
    if (!process.env.DATABASE_URL) return response.status(503).json({ error: 'DATABASE_URL is not configured.' });
    const sql = neon(process.env.DATABASE_URL);
    if (resource === 'companySettings' && request.method === 'GET') {
      await ensureCompanySettingsSchema(sql);
      const rows = await sql.query('SELECT name, short_name, intranet_name, contact_email FROM public.company_settings WHERE id=$1', ['global']);
      return response.status(200).json({ resource, record: rows[0] || null });
    }
    const user = await requireSession(request);
    const isPrivileged = user.role === 'admin' || user.role === 'manager';
    if (resource === 'companySettings') await ensureCompanySettingsSchema(sql);
    if (resource === 'notices' || resource === 'bootstrap') await ensureNoticePopupSchema(sql);
    if (resource === 'timesheetClosures' || resource === 'bootstrap' || resource === 'timesheets' || resource === 'projectAssignments') await ensureTimesheetClosureSchema(sql);
    if (request.method === 'GET') {
      if (resource === 'bootstrap') {
        const records = await loadBootstrapData(sql, user, isPrivileged);
        return response.status(200).json({ resource, records });
      }
      if (resource === 'timesheetClosures') {
        const rows = await sql.query('SELECT * FROM public.timesheet_month_closures WHERE user_id=$1 ORDER BY year_month DESC', [user.id]);
        return response.status(200).json({ resource, records: rows });
      }
      if (resource === 'projectAssignments') {
        const rows = await sql.query('SELECT project_id, planned_mm, started_on, ended_on FROM public.project_assignments WHERE user_id = $1', [user.id]);
        return response.status(200).json({ resource, records: rows });
      }
      if (resource === 'wbs') {
        const projectId = String(request.query?.projectId || '');
        const rows = await sql.query(
          `SELECT t.*, p.name AS project_name FROM public.project_wbs_tasks t JOIN public.projects p ON p.id=t.project_id${projectId ? ' WHERE t.project_id=$1' : ''} ORDER BY t.started_on ASC, t.created_at ASC`,
          projectId ? [projectId] : []
        );
        return response.status(200).json({ resource, records: rows });
      }
      if (resource === 'diaries') {
        const where = isPrivileged ? '' : ' WHERE d.user_id = $1';
        const rows = await sql.query(
          `SELECT d.*, (SELECT count(*) FROM public.diary_attachments a WHERE a.diary_id = d.id)::int AS attachment_count FROM public.diary_entries d${where} ORDER BY d.created_at DESC`,
          isPrivileged ? [] : [user.id]
        );
        return response.status(200).json({ resource, records: rows });
      }
      if (resource === 'manpower') {
        const rows = await sql.query(
          `SELECT user_id, project_id, work_date, hours, entry_type FROM public.timesheet_entries${isPrivileged ? '' : ' WHERE user_id = $1'} ORDER BY work_date ASC`,
          isPrivileged ? [] : [user.id]
        );
        return response.status(200).json({ resource, records: rows });
      }
      // 투입시간과 근태는 관리자 화면에서도 현재 로그인한 사용자의 개인 입력값만 사용한다.
      // 모든 직원 기록은 인력 투입 분석 전용 조회에서 별도로 다뤄야 하며, 개인 타임시트에 섞이면 안 된다.
      if (resource === 'timesheets' || resource === 'attendance') {
        const rows = await sql.query(`SELECT * FROM public.${config.table} WHERE user_id = $1 ORDER BY created_at DESC`, [user.id]);
        return response.status(200).json({ resource, records: rows });
      }
      const where = config.owner && !isPrivileged ? ` WHERE ${config.owner} = $1` : '';
      const rows = await sql.query(`SELECT * FROM public.${config.table}${where} ORDER BY created_at DESC`, config.owner && !isPrivileged ? [user.id] : []);
      return response.status(200).json({ resource, records: rows });
    }
    if (request.method === 'PATCH' && resource === 'approvals') {
      if (!isPrivileged) return response.status(403).json({ error: 'PM 또는 관리자만 결재를 처리할 수 있습니다.' });
      const input = body(request);
      if (!input.id || !['approved', 'rejected'].includes(input.status)) return response.status(400).json({ error: '유효한 결재 상태가 필요합니다.' });
      const rows = await sql.query('UPDATE public.approval_documents SET status = $2, updated_at = now() WHERE id = $1 AND status = $3 RETURNING *', [input.id, input.status, 'waiting']);
      if (!rows[0]) return response.status(409).json({ error: '이미 처리되었거나 찾을 수 없는 결재입니다.' });
      await sql.query('INSERT INTO public.approval_actions (document_id, actor_id, action) VALUES ($1, $2, $3)', [input.id, user.id, input.status]);
      return response.status(200).json({ resource, record: rows[0] });
    }
    if (request.method === 'PATCH' && resource === 'projects') {
      if (user.role !== 'admin') return response.status(403).json({ error: '관리자만 프로젝트를 수정할 수 있습니다.' });
      const input = body(request);
      requireFields(input, ['id', 'name', 'startedOn', 'endedOn']);
      if (input.startedOn > input.endedOn) return response.status(400).json({ error: '종료일은 시작일 이후여야 합니다.' });
      const rows = await sql.query('UPDATE public.projects SET project_code=$2, name=$3, client_name=$4, work_role=$5, started_on=$6, ended_on=$7, contract_amount=$8, planned_mm=$9, is_active=$10, updated_at=now() WHERE id=$1 RETURNING *', [input.id, input.projectCode || null, input.name, input.clientName || null, input.workRole || null, input.startedOn, input.endedOn, input.contractAmount || null, input.plannedMm || null, input.isActive !== false]);
      return response.status(rows[0] ? 200 : 404).json(rows[0] ? { resource, record: rows[0] } : { error: '프로젝트를 찾을 수 없습니다.' });
    }
    if (request.method === 'PUT' && resource === 'companySettings') {
      if (user.role !== 'admin') return response.status(403).json({ error: '관리자만 회사 정보를 변경할 수 있습니다.' });
      const input = body(request);
      requireFields(input, ['name', 'shortName', 'contactEmail']);
      const rows = await sql.query(`INSERT INTO public.company_settings (id,name,short_name,intranet_name,contact_email,updated_at)
        VALUES ('global',$1,$2,$2,$3,now()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,short_name=EXCLUDED.short_name,intranet_name=EXCLUDED.short_name,contact_email=EXCLUDED.contact_email,updated_at=now() RETURNING *`, [input.name.trim(), input.shortName.trim(), input.contactEmail.trim()]);
      return response.status(200).json({ resource, record: rows[0] });
    }
    if (request.method === 'POST' && resource === 'timesheetClosures') {
      const input = body(request);
      if (!/^\d{4}-\d{2}$/.test(String(input.yearMonth || ''))) return response.status(400).json({ error: '마감할 연월이 필요합니다.' });
      const rows = await sql.query(`INSERT INTO public.timesheet_month_closures (user_id, year_month, is_locked, closed_at, closed_by, reopened_at, reopened_by)
        VALUES ($1,$2::date,true,now(),$1,null,null) ON CONFLICT (user_id,year_month)
        DO UPDATE SET is_locked=true, closed_at=now(), closed_by=$1, reopened_at=null, reopened_by=null RETURNING *`, [user.id, monthStart(input.yearMonth)]);
      return response.status(200).json({ resource, record: rows[0] });
    }
    if (request.method === 'PATCH' && resource === 'timesheetClosures') {
      const input = body(request);
      if (!input.userId || !/^\d{4}-\d{2}$/.test(String(input.yearMonth || ''))) return response.status(400).json({ error: '해제할 직원과 연월이 필요합니다.' });
      if (user.role !== 'admin') {
        if (user.role !== 'manager') return response.status(403).json({ error: '프로젝트 PM 또는 관리자만 마감을 해제할 수 있습니다.' });
        const permitted = await sql.query(`SELECT 1 FROM public.project_assignments pa JOIN public.projects p ON p.id=pa.project_id
          WHERE pa.user_id=$1 AND p.manager_id=$2 AND pa.started_on <= $4::date AND (pa.ended_on IS NULL OR pa.ended_on >= $3::date) LIMIT 1`, [input.userId, user.id, monthStart(input.yearMonth), `${input.yearMonth}-31`]);
        if (!permitted[0]) return response.status(403).json({ error: '해당 직원의 프로젝트 PM만 마감을 해제할 수 있습니다.' });
      }
      const rows = await sql.query('UPDATE public.timesheet_month_closures SET is_locked=false, reopened_at=now(), reopened_by=$3 WHERE user_id=$1 AND year_month=$2::date RETURNING *', [input.userId, monthStart(input.yearMonth), user.id]);
      return response.status(rows[0] ? 200 : 404).json(rows[0] ? { resource, record: rows[0] } : { error: '마감 기록을 찾을 수 없습니다.' });
    }
    if (request.method === 'PATCH' && resource === 'wbs') {
      if (!isPrivileged) return response.status(403).json({ error: '관리자 또는 PM만 공정표를 수정할 수 있습니다.' });
      const input = body(request);
      requireFields(input, ['id', 'title', 'startedOn', 'endedOn']);
      if (input.startedOn > input.endedOn) return response.status(400).json({ error: '작업 종료일은 시작일 이후여야 합니다.' });
      const rows = await sql.query('UPDATE public.project_wbs_tasks SET category=$2, title=$3, started_on=$4, ended_on=$5, status=$6, note=$7, updated_at=now() WHERE id=$1 RETURNING *', [input.id, input.category || null, input.title, input.startedOn, input.endedOn, input.status || 'planned', input.note || null]);
      return response.status(rows[0] ? 200 : 404).json(rows[0] ? { resource, record: rows[0] } : { error: '작업 항목을 찾을 수 없습니다.' });
    }
    if (request.method === 'DELETE' && resource === 'wbs') {
      if (!isPrivileged) return response.status(403).json({ error: '관리자 또는 PM만 공정표를 삭제할 수 있습니다.' });
      const input = body(request);
      if (!input.id) return response.status(400).json({ error: '삭제할 작업 항목이 필요합니다.' });
      const rows = await sql.query('DELETE FROM public.project_wbs_tasks WHERE id=$1 RETURNING id', [input.id]);
      return response.status(rows[0] ? 200 : 404).json(rows[0] ? { resource, deletedId: input.id } : { error: '작업 항목을 찾을 수 없습니다.' });
    }
    if (request.method === 'POST' && resource === 'projectAssignments') {
      const input = body(request);
      if (!input.projectId || !input.yearMonth) return response.status(400).json({ error: '프로젝트와 기준 월이 필요합니다.' });
      await assertTimesheetMonthEditable(sql, user.id, `${input.yearMonth}-01`);
      // 이전 스키마가 남아 있는 연결 DB에서도 개인 배정을 즉시 사용할 수 있게 한다.
      // 원본 projects 테이블의 행에는 전혀 영향을 주지 않는다.
      await sql.query('ALTER TABLE public.project_assignments ADD COLUMN IF NOT EXISTS started_on date');
      await sql.query('ALTER TABLE public.project_assignments ADD COLUMN IF NOT EXISTS ended_on date');
      await sql.query('UPDATE public.project_assignments SET started_on = CURRENT_DATE WHERE started_on IS NULL');
      const monthStart = `${input.yearMonth}-01`;
      const monthEnd = `${input.yearMonth}-31`;
      const project = await sql.query('SELECT id FROM public.projects WHERE id=$1 AND is_active=true AND (started_on IS NULL OR started_on <= $2) AND (ended_on IS NULL OR ended_on >= $3)', [input.projectId, monthEnd, monthStart]);
      if (!project[0]) return response.status(400).json({ error: '선택한 월에 투입할 수 없는 프로젝트입니다.' });
      // 프로젝트 관리의 원본은 건드리지 않고, 로그인한 사용자의 배정만 생성/재개한다.
      // 기존 배정이 종료된 뒤 다시 추가하는 경우에는 새로 선택한 월부터 다시 표시한다.
      const existing = await sql.query('SELECT started_on, ended_on FROM public.project_assignments WHERE user_id=$1 AND project_id=$2', [user.id, input.projectId]);
      const rows = existing[0]
        ? await sql.query('UPDATE public.project_assignments SET started_on=CASE WHEN ended_on IS NULL THEN LEAST(COALESCE(started_on, $3::date), $3::date) ELSE $3::date END, ended_on=NULL WHERE user_id=$1 AND project_id=$2 RETURNING *', [user.id, input.projectId, monthStart])
        : await sql.query('INSERT INTO public.project_assignments (user_id, project_id, planned_mm, started_on, ended_on) VALUES ($1,$2,0,$3::date,NULL) RETURNING *', [user.id, input.projectId, monthStart]);
      return response.status(201).json({ resource, record: rows[0] });
    }
    if (request.method === 'DELETE' && resource === 'projectAssignments') {
      const input = body(request);
      if (!input.projectId || !input.yearMonth) return response.status(400).json({ error: '프로젝트와 종료 월이 필요합니다.' });
      await assertTimesheetMonthEditable(sql, user.id, `${input.yearMonth}-01`);
      const monthStart = `${input.yearMonth}-01`;
      const rows = await sql.query('UPDATE public.project_assignments SET ended_on = ($3::date - interval \'1 day\')::date WHERE user_id=$1 AND project_id=$2 AND started_on < $3::date RETURNING *', [user.id, input.projectId, monthStart]);
      if (!rows[0]) await sql.query('DELETE FROM public.project_assignments WHERE user_id=$1 AND project_id=$2', [user.id, input.projectId]);
      return response.status(200).json({ resource, projectId: input.projectId });
    }
    if (request.method === 'DELETE' && resource === 'timesheets') {
      const input = body(request);
      if (!input.workDate || !input.entryType) return response.status(400).json({ error: '삭제할 타임시트 날짜와 유형이 필요합니다.' });
      await assertTimesheetMonthEditable(sql, user.id, input.workDate);
      const rows = await sql.query(
        'DELETE FROM public.timesheet_entries WHERE user_id = $1 AND work_date = $2 AND entry_type = $3 AND project_id IS NOT DISTINCT FROM $4 RETURNING id',
        [user.id, input.workDate, input.entryType, input.projectId || null]
      );
      return response.status(200).json({ resource, deleted: Boolean(rows[0]) });
    }
    if (request.method === 'PATCH' && resource === 'diaries') {
      const input = body(request);
      requireFields(input, ['id', 'workDate', 'hours', 'content']);
      const owners = await sql.query('SELECT user_id FROM public.diary_entries WHERE id = $1 AND (user_id = $2 OR $3 = true)', [input.id, user.id, user.role === 'admin']);
      if (!owners[0]) return response.status(403).json({ error: '업무일지 수정 권한이 없거나 항목을 찾을 수 없습니다.' });
      const projectError = await validateDiaryProject(sql, owners[0].user_id, input.projectId, input.workDate);
      if (projectError) return response.status(400).json({ error: projectError });
      const rows = await sql.query(
        'UPDATE public.diary_entries SET project_id = $2, work_date = $3, hours = $4, content = $5, updated_at = now() WHERE id = $1 AND (user_id = $6 OR $7 = true) RETURNING *',
        [input.id, input.projectId || null, input.workDate, input.hours, input.content, user.id, user.role === 'admin']
      );
      if (!rows[0]) return response.status(403).json({ error: '업무일지 수정 권한이 없거나 항목을 찾을 수 없습니다.' });
      return response.status(200).json({ resource, record: rows[0] });
    }
    if (request.method === 'DELETE' && resource === 'diaries') {
      const input = body(request);
      if (!input.id) return response.status(400).json({ error: '삭제할 업무일지가 필요합니다.' });
      const attachments = await sql.query(
        'SELECT a.storage_path FROM public.diary_attachments a JOIN public.diary_entries d ON d.id = a.diary_id WHERE d.id = $1 AND (d.user_id = $2 OR $3 = true)',
        [input.id, user.id, user.role === 'admin']
      );
      const rows = await sql.query('DELETE FROM public.diary_entries WHERE id = $1 AND (user_id = $2 OR $3 = true) RETURNING id', [input.id, user.id, user.role === 'admin']);
      if (!rows[0]) return response.status(403).json({ error: '업무일지 삭제 권한이 없거나 항목을 찾을 수 없습니다.' });
      await Promise.all(attachments.filter(item => item.storage_path.startsWith('diary/')).map(item => del(item.storage_path).catch(() => null)));
      return response.status(200).json({ resource, deletedId: rows[0].id });
    }
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });

    const input = body(request);
    let rows;
    if (resource === 'projects') {
      if (user.role !== 'admin') return response.status(403).json({ error: '관리자만 프로젝트를 등록할 수 있습니다.' });
      requireFields(input, ['name', 'startedOn', 'endedOn']);
      if (input.startedOn > input.endedOn) return response.status(400).json({ error: '종료일은 시작일 이후여야 합니다.' });
      rows = await sql.query('INSERT INTO public.projects (id, project_code, name, client_name, work_role, manager_id, started_on, ended_on, contract_amount, planned_mm, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) RETURNING *', [id('project'), input.projectCode || null, input.name, input.clientName || null, input.workRole || null, user.id, input.startedOn, input.endedOn, input.contractAmount || null, input.plannedMm || null]);
    } else if (resource === 'wbs') {
      if (!isPrivileged) return response.status(403).json({ error: '관리자 또는 PM만 공정표를 등록할 수 있습니다.' });
      requireFields(input, ['projectId', 'title', 'startedOn', 'endedOn']);
      if (input.startedOn > input.endedOn) return response.status(400).json({ error: '작업 종료일은 시작일 이후여야 합니다.' });
      rows = await sql.query('INSERT INTO public.project_wbs_tasks (id, project_id, category, title, started_on, ended_on, status, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [id('wbs'), input.projectId, input.category || null, input.title, input.startedOn, input.endedOn, input.status || 'planned', input.note || null, user.id]);
    } else if (resource === 'timesheets') {
      requireFields(input, ['workDate', 'hours']);
      await assertTimesheetMonthEditable(sql, user.id, input.workDate);
      if (input.entryType !== 'vacation') {
        const rows = await sql.query('SELECT p.name, p.is_active, p.started_on, p.ended_on, pa.started_on AS assignment_started_on, pa.ended_on AS assignment_ended_on FROM public.projects p LEFT JOIN public.project_assignments pa ON pa.project_id=p.id AND pa.user_id=$1 WHERE p.id=$2', [user.id, input.projectId]);
        const project = rows[0];
        if (!project) return response.status(400).json({ error: `${input.workDate}: 선택한 프로젝트를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.` });
        const projectStart = dateKey(project.started_on);
        const projectEnd = dateKey(project.ended_on);
        const assignmentStart = dateKey(project.assignment_started_on);
        const assignmentEnd = dateKey(project.assignment_ended_on);
        if (!project.is_active) return response.status(400).json({ error: `${project.name}: 종료 또는 비활성 프로젝트라 시간을 저장할 수 없습니다.` });
        if ((projectStart && input.workDate < projectStart) || (projectEnd && input.workDate > projectEnd)) return response.status(400).json({ error: `${project.name}: ${input.workDate}은 프로젝트 기간(${projectStart || '시작일 미정'} ~ ${projectEnd || '종료일 미정'}) 밖입니다. 기간 안의 날짜에만 입력해 주세요.` });
        if (!assignmentStart) return response.status(400).json({ error: `${project.name}: 내 투입 프로젝트에 아직 추가되지 않았습니다. ‘프로젝트 추가’에서 먼저 추가해 주세요.` });
        if (input.workDate < assignmentStart || (assignmentEnd && input.workDate > assignmentEnd)) return response.status(400).json({ error: `${project.name}: ${input.workDate}은 내 프로젝트 배정 기간(${assignmentStart} ~ ${assignmentEnd || '진행 중'}) 밖입니다.` });
      }
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
      const popupEnabled = Boolean(input.popupEnabled);
      if (popupEnabled && (!input.popupStart || !input.popupEnd)) return response.status(400).json({ error: '팝업 공지의 시작일과 종료일을 모두 입력해 주세요.' });
      if (popupEnabled && input.popupStart > input.popupEnd) return response.status(400).json({ error: '팝업 종료일은 시작일 이후여야 합니다.' });
      rows = await sql.query('INSERT INTO public.notices (id, author_id, category, title, content, is_pinned, popup_enabled, popup_start, popup_end) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', [id('notice'), user.id, input.category || '공지', input.title, input.content, Boolean(input.isPinned), popupEnabled, popupEnabled ? input.popupStart : null, popupEnabled ? input.popupEnd : null]);
    } else {
      requireFields(input, ['workDate', 'hours', 'content']);
      const projectError = await validateDiaryProject(sql, user.id, input.projectId, input.workDate);
      if (projectError) return response.status(400).json({ error: projectError });
      rows = await sql.query('INSERT INTO public.diary_entries (id, user_id, project_id, work_date, hours, content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id('diary'), user.id, input.projectId || null, input.workDate, input.hours, input.content]);
    }
    return response.status(201).json({ resource, record: rows[0] });
  } catch (error) {
    console.error('Intranet data request failed:', error);
    return response.status(error.status || 500).json({ error: error.status ? error.message : '업무 데이터를 불러오지 못했습니다.' });
  }
};
