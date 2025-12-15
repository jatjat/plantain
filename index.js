const { voltageToVWC } = require('./lib/vh400');

let Service, Characteristic;

function initializeHomebridge(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-plantain', 'Plantain', PlantainAccessory);
}

function extractVoltage(json, channel) {
  if (!Array.isArray(json?.samples)) {
    throw new Error(`Invalid response: expected "samples" array, got: ${JSON.stringify(json)}`)
  }

  const voltage = json.samples.find(s => Number(s?.chan) === Number(channel))?.value;

  if (typeof voltage !== 'number') {
    throw new Error(`No voltage data for channel ${channel}, samples: ${JSON.stringify(json.samples)}`);
  }

  return voltage;
}

function PlantainAccessory(log, config, api, fetcher = fetch) {
  this.log = log;
  this.name = config.name || 'Plant Moisture';
  this.ip = config.ip;
  this.channel = config.channel || 1;
  this.pollInterval = (config.pollInterval || 60) * 1000;
  this.lowThreshold = config.lowThreshold ?? 30;
  this.fetcher = fetcher;

  this.currentHumidity = 0;
  this.contactState = Characteristic.ContactSensorState.CONTACT_DETECTED;

  if (!this.ip) {
    this.log.error('No IP address configured for VegeHub');
    return;
  }

  this.informationService = new Service.AccessoryInformation()
    .setCharacteristic(Characteristic.Manufacturer, 'Vegetronix')
    .setCharacteristic(Characteristic.Model, 'VH400')
    .setCharacteristic(Characteristic.SerialNumber, this.ip);

  this.humidityService = new Service.HumiditySensor(this.name + ' Moisture');
  this.humidityService
    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .onGet(this.getHumidity.bind(this));

  this.contactService = new Service.ContactSensor(this.name + ' Alert');
  this.contactService
    .getCharacteristic(Characteristic.ContactSensorState)
    .onGet(this.getContactState.bind(this));

  this.poll();
  this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
}

PlantainAccessory.prototype.getHumidity = function () {
  return this.currentHumidity;
};

PlantainAccessory.prototype.getContactState = function () {
  return this.contactState;
};

PlantainAccessory.prototype.shouldLogStateChange = function (oldHumidity, newHumidity, oldContactState, newContactState) {
  const humidityDelta = Math.abs(newHumidity - oldHumidity);
  return humidityDelta > 0.1 || newContactState !== oldContactState;
};

PlantainAccessory.prototype.poll = async function () {
  const url = `http://${this.ip}/api/sensors/data/last`;

  try {
    const res = await this.fetcher(url);

    if (!res.ok) {
      throw new Error(`VegeHub returned status ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const voltage = extractVoltage(json, this.channel);

    const vwc = Math.max(0, Math.min(100, voltageToVWC(voltage)));
    const oldHumidity = this.currentHumidity;
    this.currentHumidity = Math.round(vwc * 10) / 10;

    const newContactState = vwc < this.lowThreshold
      ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
      : Characteristic.ContactSensorState.CONTACT_DETECTED;

    const message = `Voltage: ${voltage}V, VWC: ${this.currentHumidity}%, Alert: ${newContactState === 0 ? 'OK' : 'LOW'}`;
    this.log.debug(message);

    if (this.shouldLogStateChange(oldHumidity, this.currentHumidity, this.contactState, newContactState)) {
      this.log.info(message);
    }

    this.humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .updateValue(this.currentHumidity);

    if (newContactState !== this.contactState) {
      this.contactState = newContactState;
      this.contactService
        .getCharacteristic(Characteristic.ContactSensorState)
        .updateValue(this.contactState);
    }
  } catch (e) {
    this.log.error('Failed to update from VegeHub:', e.message);
  }
};

PlantainAccessory.prototype.getServices = function () {
  return [this.informationService, this.humidityService, this.contactService];
};

// Export for Homebridge
module.exports = initializeHomebridge;

// Export internals for testing
module.exports.PlantainAccessory = PlantainAccessory;
module.exports.setHomebridge = function (hap) {
  Service = hap.Service;
  Characteristic = hap.Characteristic;
};
module.exports.shouldLogStateChange = PlantainAccessory.prototype.shouldLogStateChange;
