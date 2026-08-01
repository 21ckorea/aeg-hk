const { Readable } = require('node:stream');
const { get } = require('@vercel/blob');
const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

module.exports = async (request, response) => {
  try {
    const user = await requireSession(request);
    const id = request.query?.id;
    if (!id) return response.status(400).json({ error: '첨부파일 정보가 없습니다.' });

    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql.query(
      'SELECT a.storage_path, a.file_name, a.content_type, d.user_id FROM public.diary_attachments a JOIN public.diary_entries d ON d.id = a.diary_id WHERE a.id = $1',
      [id]
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
  } catch (error) {
    console.error('Attachment delivery failed:', error);
    response.status(error.status || 500).json({ error: error.message || '첨부파일을 열지 못했습니다.' });
  }
};
