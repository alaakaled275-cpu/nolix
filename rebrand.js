const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "New folder (11)", "index.html");
let html = fs.readFileSync(htmlPath, "utf-8");

// Rebrand Text Details
html = html.replace(/AdCentrl/gi, "NOLIX");
html = html.replace(/The Future of Ad Tracking Software/gi, "The Future of Revenue Intelligence");
html = html.replace(/The Future of<br \/>Ad Tracking<br \/>Software/g, "The Future of<br />Revenue<br />Intelligence");
html = html.replace(/Track, manage, and optimize all your advertising campaigns in one place/gi, "Track, manage, and optimize your e-commerce revenue with Zeno AI in one centralized system.");
html = html.replace(/Now supporting 30\+ ad platforms/g, "Powered by Zeno AI Operator");
html = html.replace(/30\+<\/span><span class="stat-label">Platforms/g, '100+</span><span class="stat-label">Signals');
html = html.replace(/Ad tracking software for campaign management/gi, "A cloud-based AI system for revenue analysis, conversion optimization, and smart decision making.");

// Replace Purples with Nolix Reds
html = html.replace(/#a855f7/g, '#EF4444'); // bright purple -> primary red
html = html.replace(/#7c3aed/g, '#ba0027'); // dark purple -> dark red
html = html.replace(/#c084fc/g, '#ff4d79'); // light purple -> pinkish red

// Specific Replacements for the Body logic
html = html.replace(/<span class="logo-text">NOLIX<\/span>/g, '<span class="logo-text" style="display:flex;align-items:center;font-weight:900;letter-spacing:1px;font-size:1.1rem;"><span style="color:#fff">NOLI</span><span style="color:#EF4444">X</span></span>');

const nolixLogoSvg = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" /></svg>`;
html = html.replace(/<svg width="20" height="20" viewBox="0 0 20 20".*?<\/svg>/gs, nolixLogoSvg);

// Change Cyan branding to NOLIX Red (optional but looks great). The CSS controls most of it, but inline styles:
html = html.replace(/#00D2FF/g, "#EF4444");

// Change all CTA links to /waitlist
html = html.replace(/href="#"/g, 'href="/waitlist"');
html = html.replace(/href="#pricing"/g, 'href="/waitlist"');

// Extract body contents inside <body> </body>
const bodyMatch = html.match(/<body>(.*)<\/body>/s);
if (!bodyMatch) throw new Error("Could not find body tag");

let bodyContent = bodyMatch[1];
// Strip the script tag from the body since we handle it via next/script
bodyContent = bodyContent.replace(/<script src="app\.js"><\/script>/, "");

// Convert class to className for JSX, though dangerouslySetInnerHTML takes pure HTML!
// Since we are using dangerouslySetInnerHTML, we DO NOT need to convert class to className! It takes exact string.
// We just need to render the string.

const componentCode = `"use client";
import Script from "next/script";

export default function Home() {
  return (
    <>
      <link rel="stylesheet" href="/iso-style.css" />
      <link rel="stylesheet" href="/iso-animations.css" />
      <div dangerouslySetInnerHTML={{ __html: \`${bodyContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }} />
      <Script src="/iso-app.js" strategy="lazyOnload" />
    </>
  );
}
`;

fs.writeFileSync(path.join(__dirname, "app", "page.tsx"), componentCode);
console.log("Successfully rebranded and created app/page.tsx");
