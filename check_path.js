const path = require('path');
const fs = require('fs');

const controllersDir = 'c:\\Users\\admin\\Videos\\FAAS SYSTEM\\backend\\controllers';
const generatedDir = path.join(controllersDir, '../python/generated');
const subPath = 'PRECISION/Precision_None_192.pdf';
const filePath = path.join(generatedDir, subPath);

console.log('generatedDir:', generatedDir);
console.log('filePath:', filePath);
console.log('Exists?', fs.existsSync(filePath));
