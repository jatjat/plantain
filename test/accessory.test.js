const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock Homebridge HAP
function createMockCharacteristic() {
  return {
    value: null,
    onGetHandler: null,
    onGet(handler) {
      this.onGetHandler = handler;
      return this;
    },
    updateValue(value) {
      this.value = value;
      return this;
    }
  };
}

function createMockService(name) {
  const characteristics = {};
  return {
    name,
    setCharacteristic(key, value) {
      characteristics[key] = value;
      return this;
    },
    getCharacteristic(key) {
      if (!characteristics[key]) {
        characteristics[key] = createMockCharacteristic();
      }
      return characteristics[key];
    },
    _characteristics: characteristics
  };
}

const mockHap = {
  Service: {
    AccessoryInformation: function () { return createMockService('AccessoryInformation'); },
    HumiditySensor: function (name) { return createMockService(name); },
    ContactSensor: function (name) { return createMockService(name); }
  },
  Characteristic: {
    Manufacturer: 'Manufacturer',
    Model: 'Model',
    SerialNumber: 'SerialNumber',
    CurrentRelativeHumidity: 'CurrentRelativeHumidity',
    ContactSensorState: {
      CONTACT_DETECTED: 0,
      CONTACT_NOT_DETECTED: 1
    }
  }
};

// Helper to create mock fetch
function createMockFetch(responseData, shouldError = false) {
  return async (url) => {
    if (shouldError) {
      throw new Error('Network error');
    }
    return {
      json: async () => responseData
    };
  };
}

// Helper to create mock logger
function createMockLog() {
  return {
    messages: [],
    info(...args) { this.messages.push({ level: 'info', args }); },
    warn(...args) { this.messages.push({ level: 'warn', args }); },
    error(...args) { this.messages.push({ level: 'error', args }); },
    debug(...args) { this.messages.push({ level: 'debug', args }); }
  };
}

// Helper to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('PlantainAccessory', () => {
  let PlantainAccessory, setHomebridge;

  beforeEach(() => {
    // Fresh require to reset module state
    delete require.cache[require.resolve('../index.js')];
    const plantain = require('../index.js');
    PlantainAccessory = plantain.PlantainAccessory;
    setHomebridge = plantain.setHomebridge;
    setHomebridge(mockHap);
  });

  describe('initialization', () => {
    it('creates accessory with valid config', () => {
      const log = createMockLog();
      const config = { name: 'Test Plant', ip: '192.168.1.100', pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] });

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      clearInterval(accessory.pollTimer);

      assert.strictEqual(accessory.name, 'Test Plant');
      assert.strictEqual(accessory.ip, '192.168.1.100');
      assert.strictEqual(accessory.channel, 1);
      assert.strictEqual(accessory.lowThreshold, 30);
    });

    it('uses default values when not specified', () => {
      const log = createMockLog();
      const config = { ip: '192.168.1.100', pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] });

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      clearInterval(accessory.pollTimer);

      assert.strictEqual(accessory.name, 'Plant Moisture');
      assert.strictEqual(accessory.channel, 1);
      assert.strictEqual(accessory.lowThreshold, 30);
    });

    it('logs error when IP is missing', () => {
      const log = createMockLog();
      const config = { name: 'Test Plant' };

      const accessory = new PlantainAccessory(log, config);

      assert.ok(log.messages.some(m => m.level === 'error' && m.args[0].includes('No IP')));
    });

    it('returns three services', () => {
      const log = createMockLog();
      const config = { name: 'Test Plant', ip: '192.168.1.100', pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] });

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      clearInterval(accessory.pollTimer);
      const services = accessory.getServices();

      assert.strictEqual(services.length, 3);
    });
  });

  describe('polling', () => {
    it('updates humidity from VegeHub response', async () => {
      const log = createMockLog();
      const config = { name: 'Test', ip: '192.168.1.100', pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] }); // ~24.6% VWC

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      await wait(10);
      clearInterval(accessory.pollTimer);

      assert.ok(accessory.currentHumidity > 20 && accessory.currentHumidity < 30);
    });

    it('triggers contact sensor when below threshold', async () => {
      const log = createMockLog();
      const config = { name: 'Test', ip: '192.168.1.100', lowThreshold: 50, pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] }); // ~24.6% VWC, below 50%

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      await wait(10);
      clearInterval(accessory.pollTimer);

      assert.strictEqual(accessory.contactState, mockHap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
    });

    it('keeps contact sensor closed when above threshold', async () => {
      const log = createMockLog();
      const config = { name: 'Test', ip: '192.168.1.100', lowThreshold: 10, pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] }); // ~24.6% VWC, above 10%

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      await wait(10);
      clearInterval(accessory.pollTimer);

      assert.strictEqual(accessory.contactState, mockHap.Characteristic.ContactSensorState.CONTACT_DETECTED);
    });

    it('reads from correct channel', async () => {
      const log = createMockLog();
      const config = { name: 'Test', ip: '192.168.1.100', channel: 2, pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 0.5 }, { chan: 2, value: 2.0 }] });

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      await wait(10);
      clearInterval(accessory.pollTimer);

      // chan_2 = 2.0V = ~44.75% VWC
      assert.ok(accessory.currentHumidity > 40 && accessory.currentHumidity < 50);
    });
  });

  describe('error handling', () => {
    it('logs warning when channel data is missing', async () => {
      const log = createMockLog();
      const config = { name: 'Test', ip: '192.168.1.100', channel: 3, pollInterval: 9999 };
      const mockFetch = createMockFetch({ samples: [{ chan: 1, value: 1.5 }] }); // No chan_3

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      await wait(10);
      clearInterval(accessory.pollTimer);

      assert.ok(log.messages.some(m => m.level === 'warn'));
    });

    it('logs error on network failure', async () => {
      const log = createMockLog();
      const config = { name: 'Test', ip: '192.168.1.100', pollInterval: 9999 };
      const mockFetch = createMockFetch({}, true); // shouldError = true

      const accessory = new PlantainAccessory(log, config, null, mockFetch);
      await wait(10);
      clearInterval(accessory.pollTimer);

      assert.ok(log.messages.some(m => m.level === 'error' && m.args[0].includes('Failed to reach')));
    });
  });
});
