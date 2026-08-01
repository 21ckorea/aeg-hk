const fs = require('fs');
const { execSync } = require('child_process');

// Install marked locally if needed or just use npx. We'll use npx.
console.log('Converting MD to HTML body...');
execSync('npx -y marked -i development_estimation.md -o body.html', { stdio: 'inherit' });

const bodyHTML = fs.readFileSync('body.html', 'utf8');

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>견적서</title>
  <style>
    body {
      font-family: "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      padding: 20px;
    }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #aaa;
      padding: 8px 6px;
      word-break: keep-all;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }
    
    /* 1. 견적 요약 (Table 1) */
    table:first-of-type {
      table-layout: fixed;
    }
    table:first-of-type th {
      width: 50%;
      text-align: center;
    }
    table:first-of-type td {
      text-align: left !important;
      padding-left: 15px;
    }
    
    /* 2. 견적 세부 내역 (Table 2) */
    table:nth-of-type(2) td:nth-child(1), 
    table:nth-of-type(2) td:nth-child(4), 
    table:nth-of-type(2) td:nth-child(5), 
    table:nth-of-type(2) td:nth-child(6) { text-align: center; }
    
    table:nth-of-type(2) td:nth-child(7), 
    table:nth-of-type(2) td:nth-child(8), 
    table:nth-of-type(2) td:nth-child(9) { text-align: right; }
    
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    blockquote {
      border-left: 4px solid #0366d6;
      padding: 10px 15px;
      background-color: #f1f8ff;
      margin: 15px 0;
    }
    @page {
      size: A4 landscape;
      margin: 15mm;
    }
  </style>
</head>
<body>
  ${bodyHTML}
</body>
</html>
`;

fs.writeFileSync('development_estimation.html', htmlTemplate);
console.log('HTML generated.');

console.log('Running Chrome Headless to generate PDF...');
const chromePath = '/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome';
const cmd = `${chromePath} --headless --disable-gpu --print-to-pdf=development_estimation.pdf --no-pdf-header-footer file://$(pwd)/development_estimation.html`;

execSync(cmd, { stdio: 'inherit' });
console.log('PDF generated successfully!');
