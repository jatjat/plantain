const http = require('http');
const { voltageToVWC } = require('./lib/vh400');

let Service, Characteristic;

function initializeHomebridge(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-plantain', 'Plantain', PlantainAccessory);
}

function PlantainAccessory(log, config, api, httpClient = http) {
  this.log = log;
  this.name = config.name || 'Plant Moisture';
  this.ip = config.ip;
  this.channel = config.channel || 1;
  this.pollInterval = (config.pollInterval || 60) * 1000;
  this.lowThreshold = config.lowThreshold ?? 30;
  this.httpClient = httpClient;

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
  this.pollTimer = setInterval(this.poll.bind(this), this.pollInterval);
}

PlantainAccessory.prototype.getHumidity = function () {
  return this.currentHumidity;
};

PlantainAccessory.prototype.getContactState = function () {
  return this.contactState;
};

PlantainAccessory.prototype.poll = function () {
  const url = `http://${this.ip}/api/sensors/data/last`;

  this.httpClient.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const voltage = json[`chan_${this.channel}`];

        if (typeof voltage !== 'number') {
          this.log.warn(`No data for channel ${this.channel}`);
          return;
        }

        const vwc = Math.max(0, Math.min(100, voltageToVWC(voltage)));
        this.currentHumidity = Math.round(vwc * 10) / 10;

        const newContactState = vwc < this.lowThreshold
          ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
          : Characteristic.ContactSensorState.CONTACT_DETECTED;

        this.log.debug(`Voltage: ${voltage}V, VWC: ${this.currentHumidity}%, Alert: ${newContactState === 0 ? 'OK' : 'LOW'}`);

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
        this.log.error('Failed to parse VegeHub response:', e.message);
      }
    });
  }).on('error', (e) => {
    this.log.error('Failed to reach VegeHub:', e.message);
  });
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
