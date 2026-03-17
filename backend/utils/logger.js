// Logger utility for controlled, clean console output
class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    // Set via LOG_LEVEL environment variable or default to INFO
    const level = process.env.LOG_LEVEL || 'INFO';
    this.currentLevel = this.levels[level] || this.levels.INFO;
  }

  log(level, message, data = null) {
    if (this.levels[level] > this.currentLevel) return;

    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}]`;

    switch (level) {
      case 'ERROR':
        console.error(`${prefix} ❌ ${message}`, data || '');
        break;
      case 'WARN':
        console.warn(`${prefix} ⚠️  ${message}`, data || '');
        break;
      case 'INFO':
        console.log(`${prefix} ℹ️  ${message}`, data || '');
        break;
      case 'DEBUG':
        console.log(`${prefix} 🔍 ${message}`, data || '');
        break;
    }
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  debug(message, data) {
    this.log('DEBUG', message, data);
  }

  // Special logging for startup
  startup(message) {
    console.log(`\n🚀 ${message}\n`);
  }

  // Special logging for success
  success(message, data) {
    console.log(`✅ ${message}`, data || '');
  }

  // Special logging for HTTP requests (compact)
  http(method, path, status, duration) {
    if (this.currentLevel >= this.levels.DEBUG) {
      console.log(`📍 ${method.padEnd(6)} ${path.padEnd(40)} ${status} ${duration}ms`);
    }
  }

  // Special logging for SSE
  sse(event, message) {
    this.info(`SSE: ${event} - ${message}`);
  }

  // Separator for clarity
  separator() {
    console.log('─'.repeat(60));
  }
}

module.exports = new Logger();
 
