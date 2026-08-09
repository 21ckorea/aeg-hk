// 시연 또는 고객사별 적용 시 이 파일의 회사명과 연락처만 바꾸면 됩니다.
window.COMPANY_CONFIG = {
  name: '토담산업개발주식회사',
  shortName: '토담',
  intranetName: '토담',
  contactEmail: 'contact@todam.com'
};

window.addEventListener('DOMContentLoaded', () => {
  const { name, shortName, intranetName, contactEmail } = window.COMPANY_CONFIG;
  const replacements = [
    // 현재 배포 HTML이 동기화되기 전에도 기존 고객사명이 노출되지 않게 한다.
    ['(주)그룹환경종합건축사사무소', name],
    ['㈜그룹환경종합건축사사무소', name],
    ['AEG HK', intranetName],
    ['그룹환경', shortName]
  ];
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
});
