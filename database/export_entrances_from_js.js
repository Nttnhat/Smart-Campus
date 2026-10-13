// Chạy 1 lần: trích ENTRANCES từ js/lib/entrances.js ra JSON để migration PHP đọc. Chỉ đọc.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../js/lib/entrances.js'), 'utf8');
const start = src.indexOf('const ENTRANCES = [');
const arrStart = src.indexOf('[', start);
let depth = 0, end = -1;
for (let i = arrStart; i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const arrText = src.slice(arrStart, end);
// eslint-disable-next-line no-eval
const ENTRANCES = eval(arrText);
fs.writeFileSync(path.join(__dirname, 'entrances_export.json'), JSON.stringify(ENTRANCES, null, 1), 'utf8');
console.log('exported', ENTRANCES.length, 'entrances');
