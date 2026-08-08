const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/brand-config.js'), 'utf8');
const readConfigValue = key => {
  const match = configSource.match(new RegExp(`${key}:\\s*['\"]([^'\"]+)['\"]`));
  if (!match) throw new Error(`brand-config.js에서 ${key} 값을 찾지 못했습니다.`);
  return match[1];
};
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const name = readConfigValue('name');
const shortName = readConfigValue('shortName');
const escapedName = escapeHtml(name);
const description = `${name}의 건축 프로젝트와 사내 업무를 연결하는 통합 홈페이지입니다.`;
const shortDescription = '건축 프로젝트와 사내 업무를 연결하는 통합 홈페이지';

const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${escapedName} | 건축·프로젝트 통합 관리</title>`)
  .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${escapeHtml(description)}$2`)
  .replace(/(<meta property="og:site_name" content=")[^"]*(">)/, `$1${escapedName}$2`)
  .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${escapedName}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${escapeHtml(shortDescription)}$2`)
  .replace(/(<meta property="og:image:alt" content=")[^"]*(">)/, `$1${escapedName} 건축 프로젝트$2`)
  .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${escapedName}$2`)
  .replace(/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${escapeHtml(shortDescription)}$2`);
fs.writeFileSync(indexPath, html);

const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.name = name;
manifest.short_name = shortName;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`공유 및 설치형 앱 이름을 '${name}'으로 동기화했습니다.`);
