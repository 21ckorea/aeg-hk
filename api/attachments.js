const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

function config() {
  const url = (process.env.NEXTCLOUD_URL || '').replace(/\/$/, '');
  const user = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_APP_PASSWORD;
  const basePath = (process.env.NEXTCLOUD_BASE_PATH || 'AEG-HK/업무일지-첨부파일').replace(/^\/+|\/+$/g, '');
  if (!url || !user || !password) throw new Error('Nextcloud storage is not configured.');
  return { url, user, password, basePath };
}

function safeName(name) { return String(name || 'file').replace(/[^a-zA-Z0-9._-가-힣]/g, '_').slice(0, 120); }

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const user = await requireSession(request);
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
    const { diaryId, fileName, contentType, data, byteSize, storagePath: directPath } = typeof request.body === 'string' ? JSON.parse(request.body) : request.body || {};
    if (!diaryId || !fileName) return response.status(400).json({ error: '업무일지와 파일이 필요합니다.' });
    const sql = neon(process.env.DATABASE_URL);
    const owner = await sql.query('SELECT id FROM public.diary_entries WHERE id = $1 AND user_id = $2', [diaryId, user.id]);
    if (!owner[0] && user.role !== 'admin') return response.status(403).json({ error: '첨부 권한이 없습니다.' });
    const bytes = data ? Buffer.from(data, 'base64') : null;
    if (bytes && (!bytes.length || bytes.length > 4 * 1024 * 1024)) return response.status(413).json({ error: '서버 경유 첨부는 4MB 이하만 가능합니다.' });
    let storagePath = directPath;
    if (!storagePath) {
      const nextcloud = config();
      storagePath = `${nextcloud.basePath}/${diaryId}/${crypto.randomUUID()}-${safeName(fileName)}`;
      const remoteUrl = `${nextcloud.url}/remote.php/dav/files/${encodeURIComponent(nextcloud.user)}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
      const auth = `Basic ${Buffer.from(`${nextcloud.user}:${nextcloud.password}`).toString('base64')}`;
      const upload = await fetch(remoteUrl, { method: 'PUT', headers: { Authorization: auth, 'Content-Type': contentType || 'application/octet-stream' }, body: bytes });
      if (!upload.ok) throw new Error(`Nextcloud upload failed (${upload.status}).`);
    }
    const id = `attachment-${crypto.randomUUID()}`;
    await sql.query('INSERT INTO public.diary_attachments (id, diary_id, uploader_id, file_name, content_type, byte_size, storage_path) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, diaryId, user.id, safeName(fileName), contentType || null, bytes ? bytes.length : Number(byteSize), storagePath]);
    return response.status(201).json({ attachment: { id, fileName: safeName(fileName), byteSize: bytes ? bytes.length : Number(byteSize) } });
  } catch (error) {
    console.error('Attachment upload failed:', error);
    return response.status(error.status || 500).json({ error: error.message || '첨부파일 업로드에 실패했습니다.' });
  }
};
