
const fs = require('fs');
const content = fs.readFileSync('src/pages/FAASForm.tsx', 'utf8');

const divOpen = (content.match(/<div(\s|>)/g) || []).length;
const divClose = (content.match(/<\/div>/g) || []).length;
const braceOpen = (content.match(/\{/g) || []).length;
const braceClose = (content.match(/\}/g) || []).length;
const parenOpen = (content.match(/\(/g) || []).length;
const parenClose = (content.match(/\)/g) || []).length;

console.log(`Divs: Open=${divOpen}, Close=${divClose}, Diff=${divOpen - divClose}`);
console.log(`Braces: Open=${braceOpen}, Close=${braceClose}, Diff=${braceOpen - braceClose}`);
console.log(`Parens: Open=${parenOpen}, Close=${parenClose}, Diff=${parenOpen - parenClose}`);

// Find unclosed tags if diff != 0
if (divOpen !== divClose) {
    console.log('Balance issue in divs');
}
if (braceOpen !== braceClose) {
    console.log('Balance issue in braces');
}
