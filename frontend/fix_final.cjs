const fs = require('fs');
let content = fs.readFileSync('src/components/Login.jsx', 'utf8');

// Remove formatProductionYears function (lines 16-39)
const regex = /\nfunction formatProductionYears\(records\) \{[\s\S]*?\n\}\n/;
content = content.replace(regex, '\n');

fs.writeFileSync('src/components/Login.jsx', content);
console.log('Done');
