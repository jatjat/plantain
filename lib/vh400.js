// Official VH400 piecewise curve from Vegetronix
// https://www.vegetronix.com/Products/VH400/VH400-Piecewise-Curve

/**
 * Convert VH400 sensor voltage to Volumetric Water Content (VWC) percentage.
 * @param {number} voltage - Sensor voltage (0-3V)
 * @returns {number} VWC percentage (0-100)
 */
function voltageToVWC(voltage) {
  if (voltage <= 0) return 0;
  if (voltage < 1.1) return Math.max(0, 10 * voltage - 1);
  if (voltage < 1.3) return 25 * voltage - 17.5;
  if (voltage < 1.82) return 48.08 * voltage - 47.5;
  if (voltage < 2.2) return 26.32 * voltage - 7.89;
  if (voltage <= 3.0) return 62.5 * voltage - 87.5;
  return 100;
}

module.exports = { voltageToVWC };
