const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "New folder (11)", "index.html");
let html = fs.readFileSync(htmlPath, "utf-8");

// Rebrand Text Details (ONLY the name as requested)
html = html.replace(/AdCentrl/g, "NOLIX");
html = html.replace(/ADCENTRL/g, "NOLIX");

// Change the logo SVG string
const nolixLogoSvg = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M50 15 L85 35 L85 75 L50 95 L50 63 L65 54 L65 43 L50 34 L35 43 L35 54 L50 63 L50 95 L15 75 L15 35 Z" fill="#EF4444" /></svg>`;
html = html.replace(/<svg width="20" height="20" viewBox="0 0 20 20".*?<\/svg>/gs, nolixLogoSvg);
html = html.replace(/<span class="logo-text">NOLIX<\/span>/g, '<span class="logo-text" style="display:flex;align-items:center;font-weight:900;letter-spacing:1px;font-size:1.1rem;"><span style="color:#fff">NOLI</span><span style="color:#EF4444">X</span></span>');

// Change CTA links to /waitlist
html = html.replace(/href="#"/g, 'href="/waitlist"');
html = html.replace(/href="#pricing"/g, 'href="/waitlist"');

// Extract body contents inside <body> </body>
const bodyMatch = html.match(/<body>(.*)<\/body>/s);
if (!bodyMatch) throw new Error("Could not find body tag");

let bodyContent = bodyMatch[1];
// Strip the script tag from the body since we handle it via next/script
bodyContent = bodyContent.replace(/<script src="app\.js"><\/script>/, "");

const componentCode = `"use client";
import Script from "next/script";
import "./iso-style.css";
import "./iso-animations.css";

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: \`${bodyContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` }} />
      <Script src="/iso-app.js" strategy="lazyOnload" />
    </>
  );
}
`;

fs.writeFileSync(path.join(__dirname, "app", "page.tsx"), componentCode);
console.log("Successfully rebuilt app/page.tsx with pure CSS imports");
