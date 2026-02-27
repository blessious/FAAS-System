
const fs = require('fs');
const content = fs.readFileSync('src/pages/FAASForm.tsx', 'utf8');
const lines = content.split('\n');

let level = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    level += opens - closes;
    if (level < 0) {
        console.log(`Error: Brace closed without opening at line ${i + 1}`);
        level = 0;
    }
}
console.log(`Final brace level: ${level}`);

level = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/<div(\s|>)/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    level += opens - closes;
    if (level < 0) {
        console.log(`Error: Div closed without opening at line ${i + 1}`);
        level = 0;
    }
}
console.log(`Final div level: ${level}`);
