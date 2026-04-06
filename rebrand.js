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
  content = content.replace(/Convert/g, 'NOLIX');
  content = content.replace(/🎯 <span>NOLI<\/span>AI/g, '<span className={styles.logoIcon}></span> NOLIX');

  // Add the grid styles to the CSS file
  if (filePath.endsWith('.css')) {
    // Replace the old hero::before with the new Synthwave Red Grid
    content = content.replace(
      /\.hero::before \{([^}]*)\}/m,
      `.hero::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 120%;
  background-image: 
    linear-gradient(rgba(255, 0, 60, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 0, 60, 0.3) 1px, transparent 1px);
  background-size: 60px 60px;
  background-position: 0 0, 0 0;
  transform-origin: 50% 100%;
  transform: perspective(600px) rotateX(60deg) scale(2);
  animation: gridMove 5s linear infinite;
  mask-image: linear-gradient(to top, rgba(0,0,0,1) 10%, transparent 60%);
  -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,1) 10%, transparent 60%);
  z-index: -1;
  pointer-events: none;
}
@keyframes gridMove {
  0% { transform: perspective(600px) rotateX(60deg) scale(2) translateY(0); }
  100% { transform: perspective(600px) rotateX(60deg) scale(2) translateY(60px); }
}

.logoIcon {
  display: inline-block;
  width: 20px;
  height: 24px;
  background-color: #ff003c;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  margin-right: 8px;
  position: relative;
  top: 2px;
}`
    );
  }

  // Update layout and logos in page.tsx
  if (filePath.endsWith('page.tsx')) {
    content = content.replace(
      /<div className={styles\.logo}>🎯 <span>NOLI<\/span>AI<\/div>/g,
      `<div className={styles.logo}><span className={styles.logoIcon}></span> NOLIX</div>`
    );
  }

  // Dashboard logo
  if (filePath.endsWith('dashboard\\page.tsx') || filePath.endsWith('dashboard/page.tsx')) {
    content = content.replace(/🎯 <span>Convert<\/span>AI/g, '<span className={styles.dashboardLogoBox}></span> NOLIX');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated', filePath);
}

const files = [
  path.join(__dirname, 'app', 'landing.module.css'),
  path.join(__dirname, 'app', 'page.tsx'),
  path.join(__dirname, 'app', 'dashboard', 'page.tsx'),
  path.join(__dirname, 'app', 'dashboard', 'dashboard.module.css')
];

for (const file of files) {
  if (fs.existsSync(file)) replaceColors(file);
}

// Add the dashboardLogoBox style to dashboard.module.css
let dCss = fs.readFileSync(path.join(__dirname, 'app', 'dashboard', 'dashboard.module.css'), 'utf8');
if (!dCss.includes('dashboardLogoBox')) {
  dCss += `\n.dashboardLogoBox {\n  display: inline-block;\n  width: 18px;\n  height: 20px;\n  background-color: #ff003c;\n  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);\n  margin-right: 6px;\n  position: relative;\n  top: 2px;\n}\n`;
  fs.writeFileSync(path.join(__dirname, 'app', 'dashboard', 'dashboard.module.css'), dCss);
}
