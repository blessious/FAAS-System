const fs = require('fs');
const path = require('path');

const PYTHON_DIR = path.resolve(__dirname, '../python');
const BASELINE_PATH = path.resolve(PYTHON_DIR, 'precision_mapping.json');
let schemaPromise = null;

const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normaliseAdjustment = (input = {}) => ({
  offsetXmm: Math.max(-50, Math.min(50, number(input.offsetXmm))),
  offsetYmm: Math.max(-50, Math.min(50, number(input.offsetYmm))),
  scaleX: Math.max(0.95, Math.min(1.05, number(input.scaleX, 1))),
  scaleY: Math.max(0.95, Math.min(1.05, number(input.scaleY, 1))),
  rotationDeg: Math.max(-3, Math.min(3, number(input.rotationDeg))),
});

async function ensureTdcCalibrationSchema(pool) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS tdc_layout_baselines (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      form_revision VARCHAR(100) NOT NULL DEFAULT 'TDC-8x11-v1',
      mapping_json JSON NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tdc_baseline_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tdc_calibration_profiles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      owner_user_id INT NOT NULL,
      baseline_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(120) NOT NULL,
      printer_name VARCHAR(160) NOT NULL,
      paper_batch VARCHAR(160) NOT NULL,
      form_revision VARCHAR(100) NOT NULL DEFAULT 'TDC-8x11-v1',
      visibility ENUM('private','published') NOT NULL DEFAULT 'private',
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      is_archived TINYINT(1) NOT NULL DEFAULT 0,
      profile_revision INT NOT NULL DEFAULT 1,
      published_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tdc_profile_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_tdc_profile_baseline FOREIGN KEY (baseline_id) REFERENCES tdc_layout_baselines(id),
      INDEX idx_tdc_profile_owner (owner_user_id),
      INDEX idx_tdc_profile_visibility (visibility, is_archived)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tdc_profile_page_adjustments (
      profile_id BIGINT UNSIGNED NOT NULL,
      page_number TINYINT UNSIGNED NOT NULL,
      offset_x_mm DECIMAL(8,3) NOT NULL DEFAULT 0,
      offset_y_mm DECIMAL(8,3) NOT NULL DEFAULT 0,
      scale_x DECIMAL(8,5) NOT NULL DEFAULT 1,
      scale_y DECIMAL(8,5) NOT NULL DEFAULT 1,
      rotation_deg DECIMAL(7,3) NOT NULL DEFAULT 0,
      PRIMARY KEY (profile_id, page_number),
      CONSTRAINT fk_tdc_page_profile FOREIGN KEY (profile_id) REFERENCES tdc_calibration_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tdc_profile_field_overrides (
      profile_id BIGINT UNSIGNED NOT NULL,
      field_key VARCHAR(160) NOT NULL,
      delta_x_mm DECIMAL(8,3) NOT NULL DEFAULT 0,
      delta_y_mm DECIMAL(8,3) NOT NULL DEFAULT 0,
      font_delta_pt DECIMAL(6,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (profile_id, field_key),
      CONSTRAINT fk_tdc_field_profile FOREIGN KEY (profile_id) REFERENCES tdc_calibration_profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS user_tdc_settings (
      user_id INT NOT NULL PRIMARY KEY,
      default_profile_id BIGINT UNSIGNED NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tdc_setting_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_tdc_setting_profile FOREIGN KEY (default_profile_id) REFERENCES tdc_calibration_profiles(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tdc_precision_print_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      record_id INT NOT NULL,
      profile_id BIGINT UNSIGNED NULL,
      profile_revision INT NULL,
      generated_by INT NOT NULL,
      mapping_snapshot JSON NOT NULL,
      pdf_path VARCHAR(600) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tdc_job_record FOREIGN KEY (record_id) REFERENCES faas_records(id) ON DELETE CASCADE,
      CONSTRAINT fk_tdc_job_profile FOREIGN KEY (profile_id) REFERENCES tdc_calibration_profiles(id) ON DELETE SET NULL,
      CONSTRAINT fk_tdc_job_user FOREIGN KEY (generated_by) REFERENCES users(id),
      INDEX idx_tdc_job_record (record_id), INDEX idx_tdc_job_profile (profile_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tdc_legacy_record_mappings (
      record_id INT NOT NULL PRIMARY KEY,
      mapping_json JSON NOT NULL,
      source_path VARCHAR(600) NULL,
      imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tdc_legacy_record FOREIGN KEY (record_id) REFERENCES faas_records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [baselines] = await pool.query('SELECT id FROM tdc_layout_baselines WHERE is_active = 1 LIMIT 1');
    if (!baselines.length && fs.existsSync(BASELINE_PATH)) {
      const mapping = fs.readFileSync(BASELINE_PATH, 'utf8');
      await pool.execute('INSERT INTO tdc_layout_baselines (mapping_json) VALUES (?)', [mapping]);
    }

    if (fs.existsSync(PYTHON_DIR)) {
      for (const file of fs.readdirSync(PYTHON_DIR)) {
        const match = /^precision_mapping_(\d+)\.json$/.exec(file);
        if (!match) continue;
        try {
          const sourcePath = path.resolve(PYTHON_DIR, file);
          const mapping = fs.readFileSync(sourcePath, 'utf8');
          await pool.execute(
            'INSERT IGNORE INTO tdc_legacy_record_mappings (record_id, mapping_json, source_path) VALUES (?, ?, ?)',
            [Number(match[1]), mapping, sourcePath]
          );
        } catch { /* A malformed legacy file must not stop profile setup. */ }
      }
    }
  })();
  return schemaPromise;
}

async function getActiveBaseline(pool) {
  const [rows] = await pool.query('SELECT * FROM tdc_layout_baselines WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
  if (!rows.length) throw new Error('No active TDC baseline is configured');
  return { ...rows[0], mapping: parseJson(rows[0].mapping_json) };
}

function canManage(profile, user) {
  return user.role === 'administrator' || Number(profile.owner_user_id) === Number(user.id);
}

async function getAccessibleProfile(pool, profileId, user, mutable = false) {
  const [rows] = await pool.execute('SELECT * FROM tdc_calibration_profiles WHERE id = ? AND is_archived = 0', [profileId]);
  if (!rows.length) return null;
  const profile = rows[0];
  const owned = Number(profile.owner_user_id) === Number(user.id);
  const visible = owned || profile.visibility === 'published' || user.role === 'administrator';
  if (!visible || (mutable && (!canManage(profile, user) || (profile.visibility === 'published' && user.role !== 'administrator')))) return null;
  return profile;
}

async function readProfileDetails(pool, profile) {
  const [adjustments] = await pool.execute('SELECT * FROM tdc_profile_page_adjustments WHERE profile_id = ? ORDER BY page_number', [profile.id]);
  const [overrides] = await pool.execute('SELECT * FROM tdc_profile_field_overrides WHERE profile_id = ?', [profile.id]);
  return {
    ...profile,
    adjustments: [1, 2].map(page => {
      const row = adjustments.find(item => Number(item.page_number) === page) || {};
      return { pageNumber: page, offsetXmm: number(row.offset_x_mm), offsetYmm: number(row.offset_y_mm), scaleX: number(row.scale_x, 1), scaleY: number(row.scale_y, 1), rotationDeg: number(row.rotation_deg) };
    }),
    fieldOverrides: overrides.map(row => ({ fieldKey: row.field_key, deltaXmm: number(row.delta_x_mm), deltaYmm: number(row.delta_y_mm), fontDeltaPt: number(row.font_delta_pt) })),
  };
}

function transformCoordinate(coord, adjustment, override) {
  const a = normaliseAdjustment(adjustment);
  const x = number(coord.x) * 10 * a.scaleX;
  const y = number(coord.y) * 10 * a.scaleY;
  const radians = a.rotationDeg * Math.PI / 180;
  const finalX = (x * Math.cos(radians)) - (y * Math.sin(radians)) + a.offsetXmm + number(override?.deltaXmm);
  const finalY = (x * Math.sin(radians)) + (y * Math.cos(radians)) + a.offsetYmm + number(override?.deltaYmm);
  const result = { ...coord, x: Number((finalX / 10).toFixed(4)), y: Number((finalY / 10).toFixed(4)) };
  if (override && number(override.fontDeltaPt)) result.fontSize = Number((number(coord.fontSize, 10.5) + number(override.fontDeltaPt)).toFixed(2));
  return result;
}

function resolveMapping(baselineMapping, details) {
  const adjustmentByPage = Object.fromEntries((details.adjustments || []).map(item => [item.pageNumber, item]));
  const overrideByKey = Object.fromEntries((details.fieldOverrides || []).map(item => [item.fieldKey, item]));
  return Object.fromEntries(Object.entries(baselineMapping).map(([key, coord]) => {
    const page = key.startsWith('Sheet2!') ? 2 : 1;
    return [key, transformCoordinate(coord, adjustmentByPage[page], overrideByKey[key])];
  }));
}

async function resolvePrintMapping(pool, user, requestedProfileId, recordId, draftAdjustments) {
  await ensureTdcCalibrationSchema(pool);
  let profile = null;
  if (requestedProfileId) profile = await getAccessibleProfile(pool, requestedProfileId, user);
  if (!profile && !requestedProfileId) {
    const [settings] = await pool.execute('SELECT default_profile_id FROM user_tdc_settings WHERE user_id = ?', [user.id]);
    if (settings[0]?.default_profile_id) profile = await getAccessibleProfile(pool, settings[0].default_profile_id, user);
  }
  if (requestedProfileId && !profile) {
    const error = new Error('The selected calibration profile is unavailable');
    error.status = 404;
    throw error;
  }
  if (profile) {
    const details = await readProfileDetails(pool, profile);
    if (draftAdjustments) details.adjustments = [1, 2].map(page => normaliseAdjustment(draftAdjustments[String(page)] || draftAdjustments[page] || details.adjustments.find(item => item.pageNumber === page)));
    const [baselineRows] = await pool.execute('SELECT mapping_json FROM tdc_layout_baselines WHERE id = ?', [profile.baseline_id]);
    const mapping = resolveMapping(parseJson(baselineRows[0]?.mapping_json), details);
    return { mapping, source: 'profile', profile: details };
  }
  const [legacy] = await pool.execute('SELECT mapping_json FROM tdc_legacy_record_mappings WHERE record_id = ?', [recordId]);
  const baseline = await getActiveBaseline(pool);
  if (legacy.length) return { mapping: { ...baseline.mapping, ...parseJson(legacy[0].mapping_json) }, source: 'legacy', profile: null };
  return { mapping: baseline.mapping, source: 'baseline', profile: null };
}

module.exports = {
  ensureTdcCalibrationSchema, getActiveBaseline, getAccessibleProfile, readProfileDetails,
  resolvePrintMapping, normaliseAdjustment, canManage, parseJson, transformCoordinate, resolveMapping,
};
