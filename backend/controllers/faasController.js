const { getConnection } = require('../utils/database');
const printController = require('./printController');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Helper function for PDF generation (unchanged)
async function generatePDF(recordId, excelFilePath) {
  try {
    const pythonDir = path.resolve(__dirname, '../python');
    const pythonScript = path.join(pythonDir, 'pdf_converter.py');

    if (!fs.existsSync(pythonScript)) {
      return { success: false, error: 'PDF converter script not found' };
    }

    const pdfDir = path.join(path.dirname(excelFilePath), 'generated-pdf');
    const pdfFilename = path.basename(excelFilePath).replace('.xlsx', '.pdf');
    const pdfPath = path.join(pdfDir, pdfFilename);

    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const absoluteExcelPath = path.resolve(excelFilePath);
    const absolutePdfPath = path.resolve(pdfPath);

    const command = `cd "${pythonDir}" && python pdf_converter.py --excel-path "${absoluteExcelPath}" --pdf-path "${absolutePdfPath}"`;

    console.log(`📄 PDF Conversion Command: ${command}`);

    return new Promise((resolve) => {
      exec(command, { cwd: pythonDir }, (error, stdout, stderr) => {
        if (stdout) console.log('📄 PDF Conversion STDOUT:', stdout);
        if (stderr) console.error('📄 PDF Conversion STDERR:', stderr);

        if (error) {
          console.error('❌ PDF process error:', error.message);
          resolve({
            success: false,
            error: stderr || error.message,
            message: 'PDF conversion process failed'
          });
          return;
        }

        try {
          // Look for any line that starts with { and ends with }
          const lines = stdout.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const jsonData = JSON.parse(line);
                if (jsonData.success) {
                  resolve({
                    success: true,
                    message: 'PDF generated successfully',
                    data: { pdfPath: jsonData.pdf_path || pdfPath }
                  });
                  return;
                } else {
                  console.error('❌ PDF script reported failure:', jsonData.error);
                  resolve({
                    success: false,
                    error: jsonData.error,
                    message: 'PDF generation failed'
                  });
                  return;
                }
              } catch (e) {
                // Not valid JSON, continue searching
              }
            }
          }
        } catch (parseError) {
          console.error('❌ PDF result parsing error:', parseError.message);
        }

        // Fallback: check if file actually exists even if parsing failed
        if (fs.existsSync(pdfPath)) {
          console.log(`✅ PDF found on disk at fallback: ${pdfPath}`);
          resolve({
            success: true,
            message: 'PDF generated successfully',
            data: { pdfPath }
          });
        } else {
          resolve({
            success: false,
            error: 'PDF file was not created by script',
            message: 'PDF generation failed'
          });
        }
      });
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return {
      success: false,
      error: error.message,
      message: 'PDF generation failed with error'
    };
  }
}

class FAASController {
  // Centralized database error handler
  handleDatabaseError(error, defaultMessage) {
    console.error(`❌ ${defaultMessage}:`, error);

    if (error.code === 'ER_DUP_ENTRY') {
      const match = error.sqlMessage?.match(/Duplicate entry '(.+)' for key '(.+)'/);
      if (match) {
        const entryValue = match[1];
        const keyName = match[2];
        if (keyName.includes('oct_tct_no')) {
          return `Duplicate error: The OCT/TCT No. '${entryValue}' is already registered in the system.`;
        } else if (keyName.includes('pin')) {
          return `Duplicate error: The PIN '${entryValue}' is already assigned to another record.`;
        } else if (keyName.includes('arf_no')) {
          return `Duplicate error: The ARF No. '${entryValue}' already exists.`;
        } else {
          return `Duplicate entry error: ${entryValue} already exists for ${keyName}.`;
        }
      }
      return `Duplicate entry error: ${error.sqlMessage || error.message}`;
    }

    if (error.code === 'ER_BAD_NULL_ERROR') {
      const match = error.sqlMessage?.match(/Column '(.+)' cannot be null/);
      if (match) {
        return `Required field missing: The column '${match[1]}' is mandatory.`;
      }
      return `Database Error: A required field is missing.`;
    }

    if (error.code === 'ER_DATA_TOO_LONG') {
      const match = error.sqlMessage?.match(/Data too long for column '(.+)'/);
      if (match) {
        return `Input too long: The value for '${match[1]}' exceeds the maximum allowed length.`;
      }
      return `Input too long: One of your inputs exceeds the database limit.`;
    }

    // Always include the technical error if available
    if (error.sqlMessage) {
      return `Database Error: ${error.sqlMessage}`;
    }

    return error.message || defaultMessage;
  }

  async createRecord(req, res) {
    try {
      const {
        arf_no,
        pin,
        oct_tct_no,
        cln,
        owner_name,
        owner_address,
        owner_barangay,
        owner_municipality,
        owner_province,
        administrator_name,
        administrator_address,
        owner_administrator,
        property_location,
        property_barangay,
        property_municipality,
        property_province,
        north_boundary,
        south_boundary,
        east_boundary,
        west_boundary,
        classification,
        sub_class,
        area,
        unit_value_land,
        market_value,
        product_class,
        improvement_qty,
        unit_value_improvement,
        market_value_improvement,
        adj_factor,
        percent_adjustment,
        value_adjustment,
        adjusted_market_value,
        kind,
        actual_use,
        market_value_detail,
        assessment_level,
        assessed_value,
        assessed_value_detail,
        land_appraisal_total,
        improvements_total,
        adjustment_total,
        assessment_total,
        effectivity_year,
        taxability,
        tax_rate,
        previous_td_no,
        previous_owner,
        previous_av_land,
        previous_av_improvements,
        previous_total_av,
        memoranda_code,
        memoranda_paragraph,
        land_appraisals_json,
        improvements_json,
        market_values_json,
        assessments_json
      } = req.body;

      const userId = req.user.id;

      if (!pin || !oct_tct_no || !owner_name || !owner_address) {
        return res.status(400).json({
          success: false,
          error: 'PIN, OCT/TCT No., Owner Name, and Owner Address are required'
        });
      }

      const pool = getConnection();

      // Skipping ARF No uniqueness check as requested by user
      /*
      const [existing] = await pool.execute(
        'SELECT id FROM faas_records WHERE arf_no = ?',
        [arf_no]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'ARF No. already exists'
        });
      }
      */

      const processedEffectivityDate = effectivity_year && effectivity_year.trim() !== ''
        ? effectivity_year
        : null;

      const processedAssessedValue = assessed_value !== undefined && assessed_value !== null && assessed_value !== ''
        ? parseFloat(assessed_value) || null
        : null;

      const processedMarketValue = market_value !== undefined && market_value !== null && market_value !== ''
        ? parseFloat(market_value) || null
        : null;

      const processedTaxRate = tax_rate !== undefined && tax_rate !== null && tax_rate !== ''
        ? parseFloat(tax_rate) || null
        : null;

      const [result] = await pool.execute(`
  INSERT INTO faas_records (
    arf_no, pin, oct_tct_no, cln, owner_name, owner_address,
    owner_barangay, owner_municipality, owner_province,
    administrator_name, administrator_address, owner_administrator,
    property_location, property_barangay, property_municipality, property_province,
    north_boundary, south_boundary, east_boundary, west_boundary,
    classification, sub_class, area, unit_value_land, market_value,
    product_class, improvement_qty, unit_value_improvement, market_value_improvement,
    adj_factor, percent_adjustment, value_adjustment, adjusted_market_value,
    kind, actual_use, market_value_detail, assessment_level, assessed_value, assessed_value_detail,
    land_appraisal_total, improvements_total, adjustment_total, assessment_total,
    effectivity_year, taxability, tax_rate,
    previous_td_no, previous_owner, previous_av_land, previous_av_improvements, previous_total_av,
    memoranda_code, memoranda_paragraph,
    land_appraisals_json, improvements_json, market_values_json, assessments_json,
    encoder_id, status
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`, [
        arf_no,
        pin || null,
        oct_tct_no || null,
        cln || null,
        owner_name,
        owner_address || null,
        owner_barangay || null,
        owner_municipality || null,
        owner_province || null,
        administrator_name || null,                    // 10
        administrator_address || null,
        owner_administrator || null,
        property_location || null,
        property_barangay || null,
        property_municipality || null,
        property_province || null,
        north_boundary || null,
        south_boundary || null,
        east_boundary || null,
        west_boundary || null,
        classification || null,                         // 20
        sub_class || null,
        area !== undefined && area !== null && area !== '' ? parseFloat(area) : null,
        unit_value_land !== undefined && unit_value_land !== null && unit_value_land !== '' ? parseFloat(unit_value_land) : null,
        processedMarketValue,
        product_class || null,
        improvement_qty !== undefined && improvement_qty !== null && improvement_qty !== '' ? parseInt(improvement_qty) : null,
        unit_value_improvement !== undefined && unit_value_improvement !== null && unit_value_improvement !== '' ? parseFloat(unit_value_improvement) : null,
        market_value_improvement !== undefined && market_value_improvement !== null && market_value_improvement !== '' ? parseFloat(market_value_improvement) : null,
        adj_factor !== undefined && adj_factor !== null && adj_factor !== '' ? parseFloat(adj_factor) : null,
        percent_adjustment !== undefined && percent_adjustment !== null && percent_adjustment !== '' ? parseFloat(percent_adjustment) : null, // 30
        value_adjustment !== undefined && value_adjustment !== null && value_adjustment !== '' ? parseFloat(value_adjustment) : null,
        adjusted_market_value !== undefined && adjusted_market_value !== null && adjusted_market_value !== '' ? parseFloat(adjusted_market_value) : null,
        kind || null,
        actual_use || null,
        market_value_detail !== undefined && market_value_detail !== null && market_value_detail !== '' ? parseFloat(market_value_detail) : null,
        assessment_level !== undefined && assessment_level !== null && assessment_level !== '' ? parseFloat(assessment_level) : null,
        processedAssessedValue,
        assessed_value_detail !== undefined && assessed_value_detail !== null && assessed_value_detail !== '' ? parseFloat(assessed_value_detail) : null,
        land_appraisal_total !== undefined && land_appraisal_total !== null && land_appraisal_total !== '' ? parseFloat(land_appraisal_total) : null,
        improvements_total !== undefined && improvements_total !== null && improvements_total !== '' ? parseFloat(improvements_total) : null, // 40
        adjustment_total !== undefined && adjustment_total !== null && adjustment_total !== '' ? parseFloat(adjustment_total) : null,
        assessment_total !== undefined && assessment_total !== null && assessment_total !== '' ? parseFloat(assessment_total) : null,
        processedEffectivityDate,
        taxability || null,
        processedTaxRate,
        previous_td_no || null,
        previous_owner || null,
        previous_av_land !== undefined && previous_av_land !== null && previous_av_land !== '' ? parseFloat(previous_av_land) : null,
        previous_av_improvements !== undefined && previous_av_improvements !== null && previous_av_improvements !== '' ? parseFloat(previous_av_improvements) : null,
        previous_total_av !== undefined && previous_total_av !== null && previous_total_av !== '' ? parseFloat(previous_total_av) : null, // 50
        memoranda_code || null,
        memoranda_paragraph || null,
        land_appraisals_json ? (typeof land_appraisals_json === 'string' ? land_appraisals_json : JSON.stringify(land_appraisals_json)) : null,
        improvements_json ? (typeof improvements_json === 'string' ? improvements_json : JSON.stringify(improvements_json)) : null,
        market_values_json ? (typeof market_values_json === 'string' ? market_values_json : JSON.stringify(market_values_json)) : null,
        assessments_json ? (typeof assessments_json === 'string' ? assessments_json : JSON.stringify(assessments_json)) : null,
        userId,
        'draft'                                        // 58
      ]);

      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'CREATE', 'faas_records', result.insertId, `Created FAAS record ${arf_no}`]);

      // Broadcast real-time event
      if (global.broadcastSSE) {
        global.broadcastSSE('recordChange', {
          action: 'created',
          record: {
            id: result.insertId,
            arf_no: arf_no,
            owner_name: owner_name,
            status: 'draft',
            encoder_id: userId
          },
          timestamp: new Date().toISOString()
        });
      }

      res.status(201).json({
        success: true,
        message: 'FAAS record created successfully',
        data: {
          id: result.insertId,
          arf_no: arf_no
        }
      });

    } catch (error) {
      const errorMessage = this.handleDatabaseError(error, 'Failed to create FAAS record');
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          sqlMessage: error.sqlMessage
        } : undefined
      });
    }
  }

  async updateRecord(req, res) {
    try {
      const { id } = req.params;

      // Clear existing generated files on edit
      await printController.clearGeneratedFiles(id);
      const {
        arf_no,
        pin,
        oct_tct_no,
        cln,
        owner_name,
        owner_address,
        owner_barangay,
        owner_municipality,
        owner_province,
        administrator_name,
        administrator_address,
        owner_administrator,
        property_location,
        property_barangay,
        property_municipality,
        property_province,
        north_boundary,
        south_boundary,
        east_boundary,
        west_boundary,
        classification,
        sub_class,
        area,
        unit_value_land,
        market_value,
        product_class,
        improvement_qty,
        unit_value_improvement,
        market_value_improvement,
        adj_factor,
        percent_adjustment,
        value_adjustment,
        adjusted_market_value,
        kind,
        actual_use,
        market_value_detail,
        assessment_level,
        assessed_value,
        assessed_value_detail,
        land_appraisal_total,
        improvements_total,
        adjustment_total,
        assessment_total,
        effectivity_year,
        taxability,
        tax_rate,
        previous_td_no,
        previous_owner,
        previous_av_land,
        previous_av_improvements,
        previous_total_av,
        memoranda_label,
        memoranda_code,
        memoranda_paragraph,
        land_appraisals_json,
        improvements_json,
        market_values_json,
        assessments_json
      } = req.body;

      const userId = req.user.id;

      const pool = getConnection();

      const [records] = await pool.execute(
        'SELECT id, encoder_id, status FROM faas_records WHERE id = ? AND hidden = 0',
        [id]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      const record = records[0];

      // Allow all encoders and administrators to edit
      if (req.user.role !== 'encoder' && req.user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      // Allow draft, pending, or rejected records to be edited
      if (record.status !== 'draft' && record.status !== 'for_approval' && record.status !== 'rejected') {
        return res.status(400).json({
          success: false,
          error: 'Only draft, pending, or rejected records can be edited'
        });
      }

      const processedEffectivityDate = effectivity_year && effectivity_year.trim() !== ''
        ? effectivity_year
        : null;

      const processedAssessedValue = assessed_value !== undefined && assessed_value !== null && assessed_value !== ''
        ? parseFloat(assessed_value) || null
        : null;

      const processedMarketValue = market_value !== undefined && market_value !== null && market_value !== ''
        ? parseFloat(market_value) || null
        : null;

      const processedTaxRate = tax_rate !== undefined && tax_rate !== null && tax_rate !== ''
        ? parseFloat(tax_rate) || null
        : null;

      const newStatus = record.status === 'for_approval' ? 'draft' : record.status;

      await pool.execute(`
        UPDATE faas_records SET
          arf_no = ?, pin = ?, oct_tct_no = ?, cln = ?, owner_name = ?, owner_address = ?,
          owner_barangay = ?, owner_municipality = ?, owner_province = ?,
          administrator_name = ?, administrator_address = ?, owner_administrator = ?,
          property_location = ?, property_barangay = ?, property_municipality = ?, property_province = ?,
          north_boundary = ?, south_boundary = ?, east_boundary = ?, west_boundary = ?,
          classification = ?, sub_class = ?, area = ?, unit_value_land = ?, market_value = ?,
          product_class = ?, improvement_qty = ?, unit_value_improvement = ?, market_value_improvement = ?,
          adj_factor = ?, percent_adjustment = ?, value_adjustment = ?, adjusted_market_value = ?,
          kind = ?, actual_use = ?, market_value_detail = ?, assessment_level = ?, assessed_value = ?, assessed_value_detail = ?,
          land_appraisal_total = ?, improvements_total = ?, adjustment_total = ?, assessment_total = ?,
          effectivity_year = ?, taxability = ?, tax_rate = ?,
          previous_td_no = ?, previous_owner = ?, previous_av_land = ?, previous_av_improvements = ?, previous_total_av = ?,
          memoranda_label = ?, memoranda_code = ?, memoranda_paragraph = ?, 
          land_appraisals_json = ?, improvements_json = ?, market_values_json = ?, assessments_json = ?,
          status = ?, updated_at = NOW()
        WHERE id = ? AND hidden = 0
      `, [
        arf_no,
        pin || null,
        oct_tct_no || null,
        cln || null,
        owner_name,
        owner_address || null,
        owner_barangay || null,
        owner_municipality || null,
        owner_province || null,
        administrator_name || null,
        administrator_address || null,
        owner_administrator || null,
        property_location || null,
        property_barangay || null,
        property_municipality || null,
        property_province || null,
        north_boundary || null,
        south_boundary || null,
        east_boundary || null,
        west_boundary || null,
        classification || null,
        sub_class || null,
        area !== undefined && area !== null && area !== '' ? parseFloat(area) : null,
        unit_value_land !== undefined && unit_value_land !== null && unit_value_land !== '' ? parseFloat(unit_value_land) : null,
        processedMarketValue,
        product_class || null,
        improvement_qty !== undefined && improvement_qty !== null && improvement_qty !== '' ? parseInt(improvement_qty) : null,
        unit_value_improvement !== undefined && unit_value_improvement !== null && unit_value_improvement !== '' ? parseFloat(unit_value_improvement) : null,
        market_value_improvement !== undefined && market_value_improvement !== null && market_value_improvement !== '' ? parseFloat(market_value_improvement) : null,
        adj_factor !== undefined && adj_factor !== null && adj_factor !== '' ? parseFloat(adj_factor) : null,
        percent_adjustment !== undefined && percent_adjustment !== null && percent_adjustment !== '' ? parseFloat(percent_adjustment) : null,
        value_adjustment !== undefined && value_adjustment !== null && value_adjustment !== '' ? parseFloat(value_adjustment) : null,
        adjusted_market_value !== undefined && adjusted_market_value !== null && adjusted_market_value !== '' ? parseFloat(adjusted_market_value) : null,
        kind || null,
        actual_use || null,
        market_value_detail !== undefined && market_value_detail !== null && market_value_detail !== '' ? parseFloat(market_value_detail) : null,
        assessment_level !== undefined && assessment_level !== null && assessment_level !== '' ? parseFloat(assessment_level) : null,
        processedAssessedValue,
        assessed_value_detail !== undefined && assessed_value_detail !== null && assessed_value_detail !== '' ? parseFloat(assessed_value_detail) : null,
        land_appraisal_total !== undefined && land_appraisal_total !== null && land_appraisal_total !== '' ? parseFloat(land_appraisal_total) : null,
        improvements_total !== undefined && improvements_total !== null && improvements_total !== '' ? parseFloat(improvements_total) : null,
        adjustment_total !== undefined && adjustment_total !== null && adjustment_total !== '' ? parseFloat(adjustment_total) : null,
        assessment_total !== undefined && assessment_total !== null && assessment_total !== '' ? parseFloat(assessment_total) : null,
        processedEffectivityDate,
        taxability || null,
        processedTaxRate,
        previous_td_no || null,
        previous_owner || null,
        previous_av_land !== undefined && previous_av_land !== null && previous_av_land !== '' ? parseFloat(previous_av_land) : null,
        previous_av_improvements !== undefined && previous_av_improvements !== null && previous_av_improvements !== '' ? parseFloat(previous_av_improvements) : null,
        previous_total_av !== undefined && previous_total_av !== null && previous_total_av !== '' ? parseFloat(previous_total_av) : null,
        memoranda_label || null,
        memoranda_code || null,
        memoranda_paragraph || null,
        land_appraisals_json ? (typeof land_appraisals_json === 'string' ? land_appraisals_json : JSON.stringify(land_appraisals_json)) : null,
        improvements_json ? (typeof improvements_json === 'string' ? improvements_json : JSON.stringify(improvements_json)) : null,
        market_values_json ? (typeof market_values_json === 'string' ? market_values_json : JSON.stringify(market_values_json)) : null,
        assessments_json ? (typeof assessments_json === 'string' ? assessments_json : JSON.stringify(assessments_json)) : null,
        newStatus,
        id
      ]);

      const activityDesc = newStatus === 'draft' && record.status === 'for_approval'
        ? `Saved FAAS record ${arf_no} as draft (withdrawn from pending)`
        : `Updated FAAS record ${arf_no}`;
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'UPDATE', 'faas_records', id, activityDesc]);

      // Broadcast real-time event
      if (global.broadcastSSE) {
        global.broadcastSSE('recordChange', {
          action: 'updated',
          record: {
            id: id,
            arf_no: arf_no,
            owner_name: owner_name,
            status: newStatus,
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: newStatus === 'draft' && record.status === 'for_approval'
          ? 'Record saved as draft'
          : 'FAAS record updated successfully',
        status: newStatus
      });

    } catch (error) {
      const errorMessage = this.handleDatabaseError(error, 'Failed to update FAAS record');
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          sqlMessage: error.sqlMessage
        } : undefined
      });
    }
  }

  async submitForApproval(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const pool = getConnection();

      const [records] = await pool.execute(
        'SELECT id, arf_no, encoder_id, status FROM faas_records WHERE id = ? AND hidden = 0',
        [id]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      const record = records[0];

      // Allow all encoders and administrators to submit
      if (req.user.role !== 'encoder' && req.user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          error: 'Only encoders and administrators can submit records'
        });
      }

      if (record.status !== 'draft' && record.status !== 'for_approval' && record.status !== 'rejected') {
        return res.status(400).json({
          success: false,
          error: 'Only draft, pending, or rejected records can be submitted for approval'
        });
      }

      await pool.execute(
        'UPDATE faas_records SET status = "for_approval", updated_at = NOW() WHERE id = ? AND hidden = 0',
        [id]
      );

      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'SUBMIT', 'faas_records', id, `Submitted FAAS record ${record.arf_no} for approval`]);

      console.log(`📊 Generating Excel for submitted record: ${record.arf_no}`);

      const excelResult = await new Promise((resolve, reject) => {
        const mockReq = {
          body: { recordId: id },
          user: req.user
        };

        const mockRes = {
          json: (result) => resolve(result),
          status: (code) => ({
            json: (result) => {
              console.error(`⚠️ Excel generation failed (${code}):`, result.error);
              resolve({
                success: false,
                error: result.error,
                message: 'Record submitted but Excel generation failed'
              });
            }
          })
        };

        printController.generateFAASExcel(mockReq, mockRes);
      });

      let pdfResult = { success: false, message: 'PDF not generated' };
      let unirrigPdfResult = { success: false, message: 'PDF not generated' };

      let faasExcelPath = null;
      let unirrigExcelPath = null;
      if (excelResult.success && excelResult.data) {
        if (excelResult.data.faas && excelResult.data.faas.filePath) {
          faasExcelPath = excelResult.data.faas.filePath;
        } else if (excelResult.data.filePath) {
          faasExcelPath = excelResult.data.filePath;
        }
        if (excelResult.data.unirrig && excelResult.data.unirrig.filePath) {
          unirrigExcelPath = excelResult.data.unirrig.filePath;
        }
      }

      if (faasExcelPath) {
        console.log(`📄 Attempting to generate PDF preview for FAAS: ${record.arf_no}`);
        try {
          pdfResult = await generatePDF(id, faasExcelPath);
          if (pdfResult.success) {
            await pool.execute(
              'UPDATE faas_records SET pdf_preview_path = ? WHERE id = ? AND hidden = 0',
              [pdfResult.data.pdfPath, id]
            );
            console.log(`✅ PDF generated and saved: ${pdfResult.data.pdfPath}`);
          } else {
            console.log(`⚠️ PDF generation failed: ${pdfResult.error}`);
          }
        } catch (pdfError) {
          console.error(`⚠️ PDF generation error (non-critical):`, pdfError.message);
          pdfResult = {
            success: false,
            error: pdfError.message,
            message: 'PDF generation failed with error'
          };
        }
      } else {
        console.log(`⚠️ Skipping PDF generation - FAAS Excel was not generated successfully for ${record.arf_no}`);
      }

      if (unirrigExcelPath) {
        console.log(`📄 Attempting to generate PDF preview for UNIRRIG: ${record.arf_no}`);
        try {
          unirrigPdfResult = await generatePDF(id, unirrigExcelPath);
          if (unirrigPdfResult.success) {
            await pool.execute(
              'UPDATE faas_records SET unirrig_pdf_preview_path = ? WHERE id = ? AND hidden = 0',
              [unirrigPdfResult.data.pdfPath, id]
            );
            console.log(`✅ UNIRRIG PDF generated and saved: ${unirrigPdfResult.data.pdfPath}`);
          } else {
            console.log(`⚠️ UNIRRIG PDF generation failed: ${unirrigPdfResult.error}`);
          }
        } catch (pdfError) {
          console.error(`⚠️ UNIRRIG PDF generation error (non-critical):`, pdfError.message);
          unirrigPdfResult = {
            success: false,
            error: pdfError.message,
            message: 'UNIRRIG PDF generation failed with error'
          };
        }
      } else {
        console.log(`⚠️ Skipping PDF generation - UNIRRIG Excel was not generated successfully for ${record.arf_no}`);
      }

      // Broadcast real-time event
      if (global.broadcastSSE) {
        global.broadcastSSE('recordChange', {
          action: 'submitted',
          record: {
            id: id,
            arf_no: record.arf_no,
            owner_name: null,
            status: 'for_approval',
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'FAAS record submitted for approval successfully',
        excelGenerated: excelResult.success || false,
        excelMessage: excelResult.success ? 'Excel file generated successfully' :
          (excelResult.message || 'Excel generation may have failed'),
        pdfGenerated: pdfResult.success || false,
        pdfMessage: pdfResult.success ? 'PDF preview generated' :
          (pdfResult.message || 'PDF generation failed'),
        unirrigPdfGenerated: unirrigPdfResult.success || false,
        unirrigPdfMessage: unirrigPdfResult.success ? 'UNIRRIG PDF preview generated' :
          (unirrigPdfResult.message || 'UNIRRIG PDF generation failed'),
        data: {
          excel: excelResult.data || null,
          pdf: pdfResult.data || null,
          unirrigPdf: unirrigPdfResult.data || null
        }
      });

    } catch (error) {
      console.error('Submit for approval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit record for approval'
      });
    }
  }

  async getRecord(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const pool = getConnection();

      let query = `
        SELECT 
          f.*, f.unirrig_pdf_preview_path,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        WHERE f.id = ? AND f.hidden = 0
      `;

      // All encoders and administrators can view any record
      const params = [id];
      const [records] = await pool.execute(query, params);

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      res.json({
        success: true,
        data: records[0]
      });

    } catch (error) {
      console.error('Get FAAS record error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch FAAS record'
      });
    }
  }

  async getMyRecords(req, res) {
    try {
      const { status } = req.query;

      const pool = getConnection();

      let query = `
        SELECT 
          f.*,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        WHERE f.hidden = 0
      `;

      const params = [];

      // ✅ REMOVED: No user filter - shows all records to everyone
      // if (req.user.role === 'encoder') {
      //   query += ` AND f.encoder_id = ?`;
      //   params.push(userId);
      // }

      if (status) {
        query += ` AND f.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY f.created_at DESC`;

      const [records] = await pool.execute(query, params);

      res.json({
        success: true,
        data: records
      });

    } catch (error) {
      console.error('Get my FAAS records error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch your FAAS records'
      });
    }
  }
  async getDrafts(req, res) {
    try {
      const pool = getConnection();

      const [records] = await pool.execute(
        `SELECT 
          f.*,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        WHERE f.status = 'draft' 
          AND f.hidden = 0
        ORDER BY f.created_at DESC`,
        [] // ✅ No user filter
      );

      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      console.error('Get drafts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch drafts'
      });
    }
  }

  async saveAsDraft(req, res) {
    try {
      console.log('========================================');
      console.log('📝 saveAsDraft called');
      console.log('Has ID:', !!req.params.id);
      console.log('Request body keys:', Object.keys(req.body));
      console.log('ARF No:', req.body.arf_no);
      console.log('Owner Name:', req.body.owner_name);
      console.log('land_appraisals_json type:', typeof req.body.land_appraisals_json);
      console.log('improvements_json type:', typeof req.body.improvements_json);
      console.log('========================================');

      const { id } = req.params;
      const {
        arf_no,
        pin,
        oct_tct_no,
        cln,
        owner_name,
        owner_address,
        owner_barangay,
        owner_municipality,
        owner_province,
        administrator_name,
        administrator_address,
        property_location,
        property_barangay,
        property_municipality,
        property_province,
        north_boundary,
        south_boundary,
        east_boundary,
        west_boundary,
        classification,
        sub_class,
        area,
        unit_value_land,
        market_value,
        product_class,
        improvement_qty,
        unit_value_improvement,
        market_value_improvement,
        adj_factor,
        percent_adjustment,
        value_adjustment,
        adjusted_market_value,
        kind,
        actual_use,
        market_value_detail,
        assessment_level,
        assessed_value,
        assessed_value_detail,
        land_appraisal_total,
        improvements_total,
        adjustment_total,
        assessment_total,
        effectivity_year,
        taxability,
        tax_rate,
        previous_td_no,
        previous_owner,
        previous_av_land,
        previous_av_improvements,
        previous_total_av,
        memoranda_code,
        memoranda_paragraph,
        land_appraisals_json,
        improvements_json,
        market_values_json,
        assessments_json
      } = req.body;

      const userId = req.user.id;

      const pool = getConnection();

      const processedEffectivityDate = effectivity_year && effectivity_year.trim() !== ''
        ? effectivity_year
        : null;

      const processedAssessedValue = assessed_value !== undefined && assessed_value !== null && assessed_value !== ''
        ? parseFloat(assessed_value) || null
        : null;

      const processedMarketValue = market_value !== undefined && market_value !== null && market_value !== ''
        ? parseFloat(market_value) || null
        : null;

      const processedTaxRate = tax_rate !== undefined && tax_rate !== null && tax_rate !== ''
        ? parseFloat(tax_rate) || null
        : null;

      if (id) {
        // Clear existing generated files on edit
        await printController.clearGeneratedFiles(id);

        const [records] = await pool.execute(
          'SELECT id, encoder_id, status FROM faas_records WHERE id = ? AND hidden = 0',
          [id]
        );

        if (records.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Record not found'
          });
        }

        const record = records[0];

        // Allow all encoders and administrators to edit
        if (req.user.role !== 'encoder' && req.user.role !== 'administrator') {
          return res.status(403).json({
            success: false,
            error: 'Only encoders and administrators can edit records'
          });
        }

        if (record.status !== 'draft') {
          return res.status(400).json({
            success: false,
            error: 'Only draft records can be saved as draft'
          });
        }

        await pool.execute(`
          UPDATE faas_records SET
            arf_no = ?, pin = ?, oct_tct_no = ?, cln = ?, owner_name = ?, owner_address = ?,
            owner_barangay = ?, owner_municipality = ?, owner_province = ?,
            administrator_name = ?, administrator_address = ?,
            property_location = ?, property_barangay = ?, property_municipality = ?, property_province = ?,
            north_boundary = ?, south_boundary = ?, east_boundary = ?, west_boundary = ?,
            classification = ?, sub_class = ?, area = ?, unit_value_land = ?, market_value = ?,
            product_class = ?, improvement_qty = ?, unit_value_improvement = ?, market_value_improvement = ?,
            adj_factor = ?, percent_adjustment = ?, value_adjustment = ?, adjusted_market_value = ?,
            kind = ?, actual_use = ?, market_value_detail = ?, assessment_level = ?, assessed_value = ?, assessed_value_detail = ?,
            land_appraisal_total = ?, improvements_total = ?, adjustment_total = ?, assessment_total = ?,
            effectivity_year = ?, taxability = ?, tax_rate = ?,
            previous_td_no = ?, previous_owner = ?, previous_av_land = ?, previous_av_improvements = ?, previous_total_av = ?,
            memoranda_code = ?, memoranda_paragraph = ?,
            land_appraisals_json = ?, improvements_json = ?, market_values_json = ?, assessments_json = ?,
            updated_at = NOW()
          WHERE id = ? AND hidden = 0
        `, [
          arf_no,
          pin || null,
          oct_tct_no || null,
          cln || null,
          owner_name,
          owner_address || null,
          owner_barangay || null,
          owner_municipality || null,
          owner_province || null,
          administrator_name || null,
          administrator_address || null,
          property_location || null,
          property_barangay || null,
          property_municipality || null,
          property_province || null,
          north_boundary || null,
          south_boundary || null,
          east_boundary || null,
          west_boundary || null,
          classification || null,
          sub_class || null,
          area !== undefined && area !== null && area !== '' ? parseFloat(area) : null,
          unit_value_land !== undefined && unit_value_land !== null && unit_value_land !== '' ? parseFloat(unit_value_land) : null,
          processedMarketValue,
          product_class || null,
          improvement_qty !== undefined && improvement_qty !== null && improvement_qty !== '' ? parseInt(improvement_qty) : null,
          unit_value_improvement !== undefined && unit_value_improvement !== null && unit_value_improvement !== '' ? parseFloat(unit_value_improvement) : null,
          market_value_improvement !== undefined && market_value_improvement !== null && market_value_improvement !== '' ? parseFloat(market_value_improvement) : null,
          adj_factor !== undefined && adj_factor !== null && adj_factor !== '' ? parseFloat(adj_factor) : null,
          percent_adjustment !== undefined && percent_adjustment !== null && percent_adjustment !== '' ? parseFloat(percent_adjustment) : null,
          value_adjustment !== undefined && value_adjustment !== null && value_adjustment !== '' ? parseFloat(value_adjustment) : null,
          adjusted_market_value !== undefined && adjusted_market_value !== null && adjusted_market_value !== '' ? parseFloat(adjusted_market_value) : null,
          kind || null,
          actual_use || null,
          market_value_detail !== undefined && market_value_detail !== null && market_value_detail !== '' ? parseFloat(market_value_detail) : null,
          assessment_level !== undefined && assessment_level !== null && assessment_level !== '' ? parseFloat(assessment_level) : null,
          processedAssessedValue,
          assessed_value_detail !== undefined && assessed_value_detail !== null && assessed_value_detail !== '' ? parseFloat(assessed_value_detail) : null,
          land_appraisal_total !== undefined && land_appraisal_total !== null && land_appraisal_total !== '' ? parseFloat(land_appraisal_total) : null,
          improvements_total !== undefined && improvements_total !== null && improvements_total !== '' ? parseFloat(improvements_total) : null,
          adjustment_total !== undefined && adjustment_total !== null && adjustment_total !== '' ? parseFloat(adjustment_total) : null,
          assessment_total !== undefined && assessment_total !== null && assessment_total !== '' ? parseFloat(assessment_total) : null,
          processedEffectivityDate,
          taxability || null,
          processedTaxRate,
          previous_td_no || null,
          previous_owner || null,
          previous_av_land !== undefined && previous_av_land !== null && previous_av_land !== '' ? parseFloat(previous_av_land) : null,
          previous_av_improvements !== undefined && previous_av_improvements !== null && previous_av_improvements !== '' ? parseFloat(previous_av_improvements) : null,
          previous_total_av !== undefined && previous_total_av !== null && previous_total_av !== '' ? parseFloat(previous_total_av) : null,
          memoranda_code || null,
          memoranda_paragraph || null,
          land_appraisals_json ? (typeof land_appraisals_json === 'string' ? land_appraisals_json : JSON.stringify(land_appraisals_json)) : null,
          improvements_json ? (typeof improvements_json === 'string' ? improvements_json : JSON.stringify(improvements_json)) : null,
          market_values_json ? (typeof market_values_json === 'string' ? market_values_json : JSON.stringify(market_values_json)) : null,
          assessments_json ? (typeof assessments_json === 'string' ? assessments_json : JSON.stringify(assessments_json)) : null,
          id
        ]);

        await pool.execute(`
          INSERT INTO activity_log (user_id, action, table_name, record_id, description)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, 'UPDATE', 'faas_records', id, `Saved FAAS record ${arf_no} as draft`]);

        res.json({
          success: true,
          message: 'FAAS record saved as draft',
          data: { id: id }
        });

      } else {
        const [result] = await pool.execute(`
  INSERT INTO faas_records (
    arf_no, pin, oct_tct_no, cln, owner_name, owner_address,
    owner_barangay, owner_municipality, owner_province,
    administrator_name, administrator_address,
    property_location, property_barangay, property_municipality, property_province,
    north_boundary, south_boundary, east_boundary, west_boundary,
    classification, sub_class, area, unit_value_land, market_value,
    product_class, improvement_qty, unit_value_improvement, market_value_improvement,
    adj_factor, percent_adjustment, value_adjustment, adjusted_market_value,
    kind, actual_use, market_value_detail, assessment_level, assessed_value, assessed_value_detail,
    land_appraisal_total, improvements_total, adjustment_total, assessment_total,
    effectivity_year, taxability, tax_rate,
    previous_td_no, previous_owner, previous_av_land, previous_av_improvements, previous_total_av,
    memoranda_code, memoranda_paragraph,
    land_appraisals_json, improvements_json, market_values_json, assessments_json,
    encoder_id, status
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
    ?, ?, ?, ?, ?, ?, ?, ?
  )
`, [
          arf_no,
          pin || null,
          oct_tct_no || null,
          cln || null,
          owner_name,
          owner_address || null,
          owner_barangay || null,
          owner_municipality || null,
          owner_province || null,
          administrator_name || null,                    // 10
          administrator_address || null,
          property_location || null,
          property_barangay || null,
          property_municipality || null,
          property_province || null,
          north_boundary || null,
          south_boundary || null,
          east_boundary || null,
          west_boundary || null,
          classification || null,                         // 20
          sub_class || null,
          area !== undefined && area !== null && area !== '' ? parseFloat(area) : null,
          unit_value_land !== undefined && unit_value_land !== null && unit_value_land !== '' ? parseFloat(unit_value_land) : null,
          processedMarketValue,
          product_class || null,
          improvement_qty !== undefined && improvement_qty !== null && improvement_qty !== '' ? parseInt(improvement_qty) : null,
          unit_value_improvement !== undefined && unit_value_improvement !== null && unit_value_improvement !== '' ? parseFloat(unit_value_improvement) : null,
          market_value_improvement !== undefined && market_value_improvement !== null && market_value_improvement !== '' ? parseFloat(market_value_improvement) : null,
          adj_factor !== undefined && adj_factor !== null && adj_factor !== '' ? parseFloat(adj_factor) : null,
          percent_adjustment !== undefined && percent_adjustment !== null && percent_adjustment !== '' ? parseFloat(percent_adjustment) : null, // 30
          value_adjustment !== undefined && value_adjustment !== null && value_adjustment !== '' ? parseFloat(value_adjustment) : null,
          adjusted_market_value !== undefined && adjusted_market_value !== null && adjusted_market_value !== '' ? parseFloat(adjusted_market_value) : null,
          kind || null,
          actual_use || null,
          market_value_detail !== undefined && market_value_detail !== null && market_value_detail !== '' ? parseFloat(market_value_detail) : null,
          assessment_level !== undefined && assessment_level !== null && assessment_level !== '' ? parseFloat(assessment_level) : null,
          processedAssessedValue,
          assessed_value_detail !== undefined && assessed_value_detail !== null && assessed_value_detail !== '' ? parseFloat(assessed_value_detail) : null,
          land_appraisal_total !== undefined && land_appraisal_total !== null && land_appraisal_total !== '' ? parseFloat(land_appraisal_total) : null,
          improvements_total !== undefined && improvements_total !== null && improvements_total !== '' ? parseFloat(improvements_total) : null, // 40
          adjustment_total !== undefined && adjustment_total !== null && adjustment_total !== '' ? parseFloat(adjustment_total) : null,
          assessment_total !== undefined && assessment_total !== null && assessment_total !== '' ? parseFloat(assessment_total) : null,
          processedEffectivityDate,
          taxability || null,
          processedTaxRate,
          previous_td_no || null,
          previous_owner || null,
          previous_av_land !== undefined && previous_av_land !== null && previous_av_land !== '' ? parseFloat(previous_av_land) : null,
          previous_av_improvements !== undefined && previous_av_improvements !== null && previous_av_improvements !== '' ? parseFloat(previous_av_improvements) : null,
          previous_total_av !== undefined && previous_total_av !== null && previous_total_av !== '' ? parseFloat(previous_total_av) : null, // 50
          memoranda_code || null,
          memoranda_paragraph || null,
          land_appraisals_json ? (typeof land_appraisals_json === 'string' ? land_appraisals_json : JSON.stringify(land_appraisals_json)) : null,
          improvements_json ? (typeof improvements_json === 'string' ? improvements_json : JSON.stringify(improvements_json)) : null,
          market_values_json ? (typeof market_values_json === 'string' ? market_values_json : JSON.stringify(market_values_json)) : null,
          assessments_json ? (typeof assessments_json === 'string' ? assessments_json : JSON.stringify(assessments_json)) : null,
          userId,
          'draft'                                        // 58
        ]);

        await pool.execute(`
          INSERT INTO activity_log (user_id, action, table_name, record_id, description)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, 'CREATE', 'faas_records', result.insertId, `Created FAAS record ${arf_no} as draft`]);

        res.status(201).json({
          success: true,
          message: 'FAAS record saved as draft',
          data: { id: result.insertId }
        });
      }

    } catch (error) {
      const errorMessage = this.handleDatabaseError(error, 'Failed to save FAAS record as draft');
      res.status(500).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          sqlMessage: error.sqlMessage
        } : undefined
      });
    }
  }

  async deleteDraft(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const pool = getConnection();

      const [records] = await pool.execute(
        'SELECT id, encoder_id, status FROM faas_records WHERE id = ? AND hidden = 0',
        [id]
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      const record = records[0];

      // Allow all encoders and administrators to delete
      if (req.user.role !== 'encoder' && req.user.role !== 'administrator') {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      // All records can be soft-deleted by authorized users
      /* 
      if (record.status !== 'draft' && record.status !== 'for_approval') {
        return res.status(400).json({
          success: false,
          error: 'Only draft or pending records can be deleted'
        });
      }
      */

      // Soft delete - set hidden=1 instead of actual DELETE
      await pool.execute('UPDATE faas_records SET hidden = 1 WHERE id = ? AND hidden = 0', [id]);

      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'DELETE', 'faas_records', id, `Soft deleted FAAS record ${id}`]);

      // Broadcast real-time event
      if (global.broadcastSSE) {
        global.broadcastSSE('recordChange', {
          action: 'deleted',
          record: {
            id: id,
            arf_no: null,
            owner_name: null,
            status: record.status,
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'FAAS record deleted successfully'
      });

    } catch (error) {
      console.error('Delete draft error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete FAAS record'
      });
    }
  }
}

module.exports = new FAASController();