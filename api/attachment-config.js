const { requireSession } = require('./_session');

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    await requireSession(request);
    const shareUrl = process.env.NEXTCLOUD_PUBLIC_UPLOAD_URL;
    if (!shareUrl) return response.status(503).json({ error: 'NEXTCLOUD_PUBLIC_UPLOAD_URL is not configured.' });
    const parsed = new URL(shareUrl);
    const token = parsed.pathname.split('/').filter(Boolean).pop();
    if (!token) return response.status(500).json({ error: 'Invalid Nextcloud public upload URL.' });
    response.status(200).json({ webdavUrl: `${parsed.origin}/public.php/dav/files/${encodeURIComponent(token)}` });
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message || '첨부 설정을 불러오지 못했습니다.' });
  }
};
