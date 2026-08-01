const { requireSession } = require('./_session');

function config() {
  const url = (process.env.NEXTCLOUD_URL || '').replace(/\/$/, '');
  const user = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_APP_PASSWORD;
  const basePath = (process.env.NEXTCLOUD_BASE_PATH || 'AEG-HK/업무일지-첨부파일').replace(/^\/+|\/+$/g, '');
  if (!url || !user || !password) throw new Error('Nextcloud storage is not configured.');
  return { url, user, password, basePath };
}

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    await requireSession(request);
    const nextcloud = config();
    const path = nextcloud.basePath.split('/').map(encodeURIComponent).join('/');
    const auth = `Basic ${Buffer.from(`${nextcloud.user}:${nextcloud.password}`).toString('base64')}`;
    const remote = await fetch(`${nextcloud.url}/remote.php/dav/files/${encodeURIComponent(nextcloud.user)}/${path}`, { method: 'PROPFIND', headers: { Authorization: auth, Depth: '1' } });
    const xml = await remote.text();
    if (!remote.ok) throw new Error(`Nextcloud 파일 목록을 불러오지 못했습니다. (${remote.status})`);
    const hrefs = [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/g)].map(match => decodeURIComponent(match[1]));
    const prefix = `/remote.php/dav/files/${nextcloud.user}/`;
    const files = hrefs
      .map(href => href.includes(prefix) ? href.split(prefix)[1].replace(/\/$/, '') : '')
      .filter(item => item && item !== nextcloud.basePath)
      .map(storagePath => ({ storagePath, fileName: storagePath.split('/').pop() }));
    response.status(200).json({ files });
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message || '파일 목록을 불러오지 못했습니다.' });
  }
};
