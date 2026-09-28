const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseAdjustment, transformCoordinate, resolveMapping } = require('../services/tdcCalibrationService');

test('normaliseAdjustment keeps calibration controls within safe print limits', () => {
  assert.deepEqual(normaliseAdjustment({ offsetXmm: 90, offsetYmm: -90, scaleX: 4, scaleY: 0, rotationDeg: 9 }), {
    offsetXmm: 50, offsetYmm: -50, scaleX: 1.05, scaleY: 0.95, rotationDeg: 3,
  });
});

test('transformCoordinate applies page calibration in millimetres and field deltas', () => {
  const result = transformCoordinate({ x: 10, y: 5, fontSize: 10 },
    { offsetXmm: 2, offsetYmm: -1, scaleX: 1, scaleY: 1, rotationDeg: 0 },
    { deltaXmm: 1, deltaYmm: 2, fontDeltaPt: 0.5 });
  assert.equal(result.x, 10.3);
  assert.equal(result.y, 5.1);
  assert.equal(result.fontSize, 10.5);
});

test('resolveMapping keeps Sheet 1 and Sheet 2 calibration independent', () => {
  const mapping = resolveMapping({ 'Sheet1!A1': { x: 1, y: 1 }, 'Sheet2!A1': { x: 1, y: 1 } }, {
    adjustments: [
      { pageNumber: 1, offsetXmm: 1, offsetYmm: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 },
      { pageNumber: 2, offsetXmm: 0, offsetYmm: 2, scaleX: 1, scaleY: 1, rotationDeg: 0 },
    ], fieldOverrides: [],
  });
  assert.equal(mapping['Sheet1!A1'].x, 1.1);
  assert.equal(mapping['Sheet1!A1'].y, 1);
  assert.equal(mapping['Sheet2!A1'].x, 1);
  assert.equal(mapping['Sheet2!A1'].y, 1.2);
});
