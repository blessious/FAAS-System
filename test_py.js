const { exec } = require('child_process');
const path = require('path');

const command = 'python precision_pdf_generator.py --excel-path "templates/UNIRRIG_Template.xlsx"';
const pythonDir = path.resolve(__dirname, 'backend/python');

exec(command, { cwd: pythonDir }, (error, stdout, stderr) => {
    console.log('STDOUT:', stdout);
    console.log('STDERR:', stderr);
    if (error) {
        console.error('ERROR:', error);
    }
});
