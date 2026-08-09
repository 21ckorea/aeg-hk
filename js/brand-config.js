// 시연 또는 고객사별 적용 시 이 파일의 회사명과 연락처만 바꾸면 됩니다.
window.COMPANY_CONFIG = {
  name: '토담산업개발주식회사',
  shortName: '토담',
  contactEmail: 'contact@todam.com'
};

function applyCompanyConfig(config) {
  const previous = window.COMPANY_CONFIG || {};
  window.COMPANY_CONFIG = { ...window.COMPANY_CONFIG, ...config };
  const { name, shortName, contactEmail } = window.COMPANY_CONFIG;
  const replacements = [
    // 기본값 또는 직전에 적용된 회사명만 현재 설정으로 교체한다.
    [previous.name, name],
    [previous.shortName, shortName]
  ].filter(([from, to]) => from && from !== to);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (node.parentElement?.closest('script, style')) return;
    let text = node.nodeValue;
    replacements.forEach(([from, to]) => { text = text.replaceAll(from, to); });
    node.nodeValue = text;
  });

  document.title = `${name} | 건축·프로젝트 통합 관리`;
  const description = `${name}의 건축 프로젝트와 사내 업무를 연결하는 통합 홈페이지입니다.`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', name);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', name);
  document.querySelector('meta[property="og:image:alt"]')?.setAttribute('content', `${name} 건축 프로젝트`);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', name);
  document.querySelectorAll('[data-brand-contact-email]').forEach(element => {
    element.href = `mailto:${contactEmail}`;
    element.textContent = contactEmail;
  });
}

window.addEventListener('DOMContentLoaded', () => {
  applyCompanyConfig(window.COMPANY_CONFIG);
  fetch('/api/intranet-data?resource=companySettings', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (data?.record) applyCompanyConfig({ name:data.record.name, shortName:data.record.short_name, contactEmail:data.record.contact_email }); })
    .catch(() => null);
});
