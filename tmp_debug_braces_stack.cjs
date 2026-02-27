
const fs = require('fs');
const content = fs.readFileSync('src/pages/FAASForm.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{') {
            stack.push({ line: i + 1, char: j + 1 });
        } else if (char === '}') {
            if (stack.length === 0) {
                console.log(`Error: unmatched '}' at line ${i + 1}, col ${j + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

console.log(`Final stack size: ${stack.length}`);
if (stack.length > 0) {
    console.log('Unclosed braces opened at:');
    stack.forEach(s => console.log(`Line ${s.line}, col ${s.char}`));
}
