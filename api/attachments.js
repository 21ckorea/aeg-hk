const { Readable } = require('node:stream');
const crypto = require('node:crypto');
const { get, head } = require('@vercel/blob');
const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const user = await requireSession(request);
    const sql = neon(process.env.DATABASE_URL);
    if (request.method === 'GET') {
      const fileId = request.query?.fileId;
      if (fileId) {
        const rows = await sql.query(
          'SELECT a.storage_path, a.file_name, a.content_type, d.user_id FROM public.diary_attachments a JOIN public.diary_entries d ON d.id = a.diary_id WHERE a.id = $1',
          [fileId]
        );
        const attachment = rows[0];
        if (!attachment || (attachment.user_id !== user.id && user.role !== 'admin')) {
          return response.status(403).json({ error: '첨부파일 열람 권한이 없습니다.' });
        }
        const result = await get(attachment.storage_path, {
          access: 'private',
          ifNoneMatch: request.headers['if-none-match'] || undefined
        });
        if (!result) return response.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        response.setHeader('Cache-Control', 'private, no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('ETag', result.blob.etag);
        if (result.statusCode === 304) return response.status(304).end();
        response.setHeader('Content-Type', attachment.content_type || result.blob.contentType || 'application/octet-stream');
        response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
        Readable.fromWeb(result.stream).pipe(response);
        return;
      }
      const diaryId = request.query?.diaryId;
      if (!diaryId) return response.status(400).json({ error: 'diaryId is required.' });
      const owner = await sql.query('SELECT user_id FROM public.diary_entries WHERE id = $1', [diaryId]);
      if (!owner[0] || (owner[0].user_id !== user.id && user.role !== 'admin')) return response.status(403).json({ error: '첨부파일 조회 권한이 없습니다.' });
      const attachments = await sql.query('SELECT id, file_name, content_type, byte_size, created_at FROM public.diary_attachments WHERE diary_id = $1 ORDER BY created_at DESC', [diaryId]);
      return response.status(200).json({ attachments });
    }
    if (request.method === 'POST') {
      const input = typeof request.body === 'string' ? JSON.parse(request.body) : (request.body || {});
      if (!input.diaryId || !input.pathname || !input.fileName) return response.status(400).json({ error: '업무일지와 첨부파일 정보가 필요합니다.' });
      if (!String(input.pathname).startsWith(`diary/${input.diaryId}/`)) return response.status(400).json({ error: '잘못된 첨부파일 경로입니다.' });
      const owner = await sql.query('SELECT id FROM public.diary_entries WHERE id = $1 AND (user_id = $2 OR $3 = true)', [input.diaryId, user.id, user.role === 'admin']);
      if (!owner[0]) return response.status(403).json({ error: '첨부파일 등록 권한이 없습니다.' });
      const blob = await head(input.pathname, { access: 'private' });
      if (!blob) return response.status(404).json({ error: '업로드된 파일을 찾을 수 없습니다.' });
      const rows = await sql.query(
        'INSERT INTO public.diary_attachments (id, diary_id, uploader_id, file_name, content_type, byte_size, storage_path) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (storage_path) DO UPDATE SET file_name = EXCLUDED.file_name RETURNING id, file_name, content_type, byte_size',
        [`blob-${crypto.randomUUID()}`, input.diaryId, user.id, input.fileName, blob.contentType || input.contentType || null, blob.size || Number(input.byteSize) || 0, input.pathname]
      );
      return response.status(201).json({ attachment: rows[0] });
    }
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Attachment upload failed:', error);
    return response.status(error.status || 500).json({ error: error.message || '첨부파일 업로드에 실패했습니다.' });
  }
};
