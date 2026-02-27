
const fs = require('fs');
const content = fs.readFileSync('src/pages/FAASForm.tsx', 'utf8');
const lines = content.split('\n');

let level = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineDelta = 0;
    for (let char of line) {
        if (char === '{') lineDelta++;
        if (char === '}') lineDelta--;
    }
    level += lineDelta;
    if (lineDelta !== 0) {
        // console.log(`Line ${i + 1}: delta=${lineDelta}, level=${level}`);
    }
}
console.log(`Final level: ${level}`);

// Print lines where level is high and stays high
level = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
        if (char === '{') level++;
        if (char === '}') level--;
    }
    if (level > 10) { // arbitrary threshold
        // console.log(`Line ${i + 1}: level=${level}`);
    }
}

// Find unmatched braces by looking for missing closes at the end of blocks
// Actually let's just find the last few lines.

console.log('Last 10 lines of file:');
console.log(lines.slice(-10).join('\n'));
