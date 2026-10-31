const fs = require('fs');
let content = fs.readFileSync('src/components/Login.jsx', 'utf8');

// Remove formatProductionYears function
content = content.replace(/\nfunction formatProductionYears\(records\) \{[\s\S]*?\n\}\n/, '\n');

// Remove kpiError state if unused - check if kpiError is used elsewhere
// First check: is kpiError used anywhere else?
const kpiErrorUses = content.match(/kpiError/g);
console.log('kpiError uses:', kpiErrorUses ? kpiErrorUses.length : 0);

fs.writeFileSync('src/components/Login.jsx', content);
console.log('Fixed Login.jsx');
