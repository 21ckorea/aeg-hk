const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const user = await requireSession(request);
    const sql = neon(process.env.DATABASE_URL);
    if (request.method === 'GET') {
      const diaryId = request.query?.diaryId;
      if (!diaryId) return response.status(400).json({ error: 'diaryId is required.' });
      const owner = await sql.query('SELECT user_id FROM public.diary_entries WHERE id = $1', [diaryId]);
      if (!owner[0] || (owner[0].user_id !== user.id && user.role !== 'admin')) return response.status(403).json({ error: '첨부파일 조회 권한이 없습니다.' });
      const attachments = await sql.query('SELECT id, file_name, content_type, byte_size, created_at FROM public.diary_attachments WHERE diary_id = $1 ORDER BY created_at DESC', [diaryId]);
      return response.status(200).json({ attachments });
    }
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Attachment upload failed:', error);
    return response.status(error.status || 500).json({ error: error.message || '첨부파일 업로드에 실패했습니다.' });
  }
};
