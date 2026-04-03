const fs = require('fs');
const path = require('path');

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace Purples with Nolix Reds
  content = content.replace(/#a855f7/g, '#ff003c'); // bright purple -> primary red
  content = content.replace(/#7c3aed/g, '#ba0027'); // dark purple -> dark red
  content = content.replace(/#c084fc/g, '#ff4d79'); // light purple -> pinkish red
  
  // Replace references to ConvertAI with NOLIX
  content = content.replace(/ConvertAI/g, 'NOLIX');
  content = content.replace(/Convert/g, 'NOLI');
  content = content.replace(/🎯 <span>NOLI<\/span>AI/g, '<span className={styles.logoIcon}></span> NOLIX');

  // Dashboard logo
  if (filePath.endsWith('dashboard\\page.tsx') || filePath.endsWith('dashboard/page.tsx')) {
    content = content.replace(/🎯 <span>NOLI<\/span>AI/g, '<span className={styles.dashboardLogoBox}></span> NOLIX');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated', filePath);
}

const files = [
  path.join(__dirname, 'app', 'dashboard', 'page.tsx'),
  path.join(__dirname, 'app', 'dashboard', 'styles.module.css')
];

for (const file of files) {
  if (fs.existsSync(file)) replaceColors(file);
}

// Add the dashboardLogoBox style to styles.module.css
const cssPath = path.join(__dirname, 'app', 'dashboard', 'styles.module.css');
let dCss = fs.readFileSync(cssPath, 'utf8');
if (!dCss.includes('dashboardLogoBox')) {
  dCss += `\n.dashboardLogoBox {\n  display: inline-block;\n  width: 18px;\n  height: 20px;\n  background-color: #ff003c;\n  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);\n  margin-right: 6px;\n  position: relative;\n  top: 2px;\n}\n`;
  fs.writeFileSync(cssPath, dCss);
}
console.log('Done fix');
