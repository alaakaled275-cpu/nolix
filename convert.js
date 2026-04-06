const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// Replace the CSS module import
code = code.replace(/import styles from "\.\/landing\.module\.css";/g, 'import "./landing.css";');

// Replace all single {styles.className} with "className"
code = code.replace(/className=\{styles\.([a-zA-Z0-9_]+)\}/g, 'className="$1"');

// Replace the dynamic message className
code = code.replace(/className=\{\`\$\{styles\.message\} \$\{status === "success" \? styles\.messageSuccess : styles\.messageError\}\`\}/g, 
  'className={`message ${status === "success" ? "messageSuccess" : "messageError"}`}');

fs.writeFileSync('app/page.tsx', code);
console.log("Converted successfully!");
