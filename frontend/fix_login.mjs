import fs from 'fs';

let content = fs.readFileSync('src/components/Login.jsx', 'utf8');

// Remove formatProductionYears function
const start = content.indexOf('\nfunction formatProductionYears(records) {');
const end = content.indexOf('\n}', start);
if (start !== -1 && end !== -1) {
  // Find the closing brace of the function
  let depth = 1;
  let i = end;
  while (i < content.length && depth > 0) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') depth--;
    i++;
  }
  content = content.slice(0, start) + content.slice(i);
}

fs.writeFileSync('src/components/Login.jsx', content);
console.log('Done removing formatProductionYears');
