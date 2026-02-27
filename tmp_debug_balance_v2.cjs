
const fs = require('fs');
const content = fs.readFileSync('src/pages/FAASForm.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let braceLevel = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check braces
    for (let char of line) {
        if (char === '{') braceLevel++;
        if (char === '}') braceLevel--;
    }

    // Check divs (primitive regex)
    const opens = (line.match(/<div(\s|>)/g) || []).map(() => ({ line: i + 1, type: 'div' }));
    const closes = (line.match(/<\/div\s*>/g) || []).map(() => ({ line: i + 1, type: '/div' }));

    for (let op of opens) stack.push(op);
    for (let cl of closes) {
        if (stack.length === 0) {
            console.log(`Error: div closed without opening at line ${i + 1}`);
        } else {
            stack.pop();
        }
    }
}

console.log(`Final brace level: ${braceLevel}`);
console.log(`Final div stack size: ${stack.length}`);
if (stack.length > 0) {
    console.log('Unclosed divs opened at:', stack.map(s => s.line).join(', '));
}
