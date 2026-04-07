const fs = require('fs');
const path = require('path');

let html = fs.readFileSync(path.join(__dirname, 'New folder (11)', 'index.html'), 'utf-8');

// The required name change as requested
html = html.replace(/AdCentrl/g, 'NOLIX');
html = html.replace(/ADCENTRL/g, 'NOLIX');

// Logo change
const nolixLogoSvg = '<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" /></svg>'; 
html = html.replace(/<svg width="20" height="20" viewBox="0 0 20 20".*?<\/svg>/gs, nolixLogoSvg);
html = html.replace(/<span class="logo-text">NOLIX<\/span>/g, '<span class="logo-text" style="display:flex;align-items:center;font-weight:900;letter-spacing:1px;font-size:1.1rem;"><span style="color:#fff">NOLI</span><span style="color:#EF4444">X</span></span>');

// Buttons functionality fix
html = html.replace(/href="#"/g, 'href="/waitlist"');
html = html.replace(/href="#pricing"/g, 'href="/waitlist"');

// Fix asset paths
html = html.replace(/href="style\.css"/g, 'href="/iso-style.css"');
html = html.replace(/href="iso\.css"/g, 'href="/iso-animations.css"');
html = html.replace(/src="app\.js"/g, 'src="/iso-app.js"');

fs.writeFileSync(path.join(__dirname, 'public', 'nolix-home.html'), html);
console.log('Successfully generated public/nolix-home.html');
