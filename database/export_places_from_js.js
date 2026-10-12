// Chạy 1 lần: trích OFFICIAL_PLACES từ js/tdtu-vector-map.js ra JSON để migration PHP đọc.
// Không sửa file JS, chỉ đọc.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../js/tdtu-vector-map.js'), 'utf8');
const start = src.indexOf('const OFFICIAL_PLACES = [');
const arrStart = src.indexOf('[', start);
let depth = 0, end = -1;
for (let i = arrStart; i < src.length; i++) {
  if (src[i] === '[') depth++;
  else if (src[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const arrText = src.slice(arrStart, end);
// eslint-disable-next-line no-eval
const OFFICIAL_PLACES = eval(arrText);
fs.writeFileSync(path.join(__dirname, 'places_export.json'), JSON.stringify(OFFICIAL_PLACES, null, 1), 'utf8');
console.log('exported', OFFICIAL_PLACES.length, 'places');
