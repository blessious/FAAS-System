const { connectDB, getConnection } = require('./utils/database');
const { ensureTdcCalibrationSchema } = require('./services/tdcCalibrationService');

(async () => {
  try {
    await connectDB();
    await ensureTdcCalibrationSchema(getConnection());
    console.log('TDC calibration profile migration completed.');
    process.exit(0);
  } catch (error) {
    console.error('TDC calibration profile migration failed:', error);
    process.exit(1);
  }
})();
