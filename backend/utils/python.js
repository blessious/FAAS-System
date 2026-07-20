const path = require('path');

const getPythonExecutable = () => {
  const raw = process.env.PYTHON_EXECUTABLE || 'python';
  const trimmed = raw.replace(/^['"]|['"]$/g, '');
  return trimmed.includes(' ') ? `"${trimmed}"` : trimmed;
};

const buildPythonCommand = (pythonDir, scriptName, args) => {
  const pythonBin = getPythonExecutable();
  const safeArgs = args ? ` ${args}` : '';
  return `cd "${pythonDir}" && ${pythonBin} ${scriptName}${safeArgs}`;
};

module.exports = {
  getPythonExecutable,
  buildPythonCommand
};
