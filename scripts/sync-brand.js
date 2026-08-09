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
// 이전에 동기화된 회사명도 읽어 둔다. 다음 시연에서 설정 값만 바꾸고 이 명령을
// 다시 실행해도, 이전 고객사명이 새 고객사명으로 안전하게 바뀐다.
const existingFullName = html.match(/<span class="brand-full">([^<]+)<\/span>/)?.[1]?.trim();
const existingShortName = html.match(/<span class="brand-short">([^<]+)<\/span>/)?.[1]?.trim();
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${escapedName} | 건축·프로젝트 통합 관리</title>`)
  .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${escapeHtml(description)}$2`)
  .replace(/(<meta property="og:site_name" content=")[^"]*(">)/, `$1${escapedName}$2`)
  .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${escapedName}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${escapeHtml(shortDescription)}$2`)
  .replace(/(<meta property="og:image:alt" content=")[^"]*(">)/, `$1${escapedName} 건축 프로젝트$2`)
  .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, `$1${escapedName}$2`)
  .replace(/(<meta name="twitter:description" content=")[^"]*(">)/, `$1${escapeHtml(shortDescription)}$2`);

// 런타임 치환 전에 HTML 자체가 현재 회사명으로 렌더링되도록 동기화한다.
// 따라서 첫 페인트에서 이전 고객사명이 잠깐 보이지 않는다.
const textReplacements = [
  [existingFullName, name],
  [existingShortName, shortName],
  ['(주)그룹환경종합건축사사무소', name],
  ['㈜그룹환경종합건축사사무소', name],
  ['그룹환경', shortName],
  ['AEG HK', shortName]
].filter(([from]) => from).sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of textReplacements) html = html.split(from).join(to);
fs.writeFileSync(indexPath, html);

const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.name = name;
manifest.short_name = shortName;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`공유 및 설치형 앱 이름을 '${name}'으로 동기화했습니다.`);
