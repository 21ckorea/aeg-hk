const { handleUpload } = require('@vercel/blob/client');
const { neon } = require('@neondatabase/serverless');
const { requireSession } = require('./_session');

module.exports = async (request, response) => {
  try {
    const session = await requireSession(request);
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('첨부파일 저장소가 아직 연결되지 않았습니다.');
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || '{}');
        const { diaryId, fileName } = payload;
        if (payload.type === 'profile') {
          if (!fileName) throw new Error('프로필 사진 파일 정보가 없습니다.');
          if (!pathname.startsWith(`profile/${session.id}/`)) throw new Error('프로필 사진 저장 경로가 올바르지 않습니다.');
          return {
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            maximumSizeInBytes: 5 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ type: 'profile', userId: session.id, fileName })
          };
        }
        if (!diaryId || !fileName) throw new Error('잘못된 첨부파일 요청입니다.');
        const sql = neon(process.env.DATABASE_URL);
        const rows = await sql.query('SELECT id FROM public.diary_entries WHERE id = $1 AND user_id = $2', [diaryId, session.id]);
        if (!rows[0] && session.role !== 'admin') throw new Error('첨부 권한이 없습니다.');
        return {
          allowedContentTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf'],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ diaryId, userId: session.id, fileName })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload);
        const sql = neon(process.env.DATABASE_URL);
        if (payload.type === 'profile') {
          await sql.query(
            'UPDATE public.app_users SET avatar_url = $2, updated_at = now() WHERE id = $1',
            [payload.userId, blob.pathname]
          );
          return;
        }
        const { diaryId, userId, fileName } = payload;
        await sql.query(
          'INSERT INTO public.diary_attachments (id, diary_id, uploader_id, file_name, content_type, byte_size, storage_path) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (storage_path) DO NOTHING',
          [`blob-${crypto.randomUUID()}`, diaryId, userId, fileName, blob.contentType, blob.size, blob.pathname]
        );
      }
    });
    response.status(200).json(result);
  } catch (error) {
    response.status(400).json({ error: error.message || '파일 업로드를 시작하지 못했습니다.' });
  }
};
