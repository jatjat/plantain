const http = require('http');

let Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-plantain', 'Plantain', PlantainAccessory);
};

// Official VH400 piecewise curve from Vegetronix
// https://www.vegetronix.com/Products/VH400/VH400-Piecewise-Curve
function voltageToVWC(voltage) {
  if (voltage <= 0) return 0;
  if (voltage < 1.1) return 10 * voltage - 1;
  if (voltage < 1.3) return 25 * voltage - 17.5;
  if (voltage < 1.82) return 48.08 * voltage - 47.5;
  if (voltage < 2.2) return 26.32 * voltage - 7.89;
  if (voltage <= 3.0) return 62.5 * voltage - 87.5;
  return 100;
}

function PlantainAccessory(log, config) {
  this.log = log;
  this.name = config.name || 'Plant Moisture';
  this.ip = config.ip;
  this.channel = config.channel || 1;
  this.pollInterval = (config.pollInterval || 60) * 1000;
  this.lowThreshold = config.lowThreshold ?? 30;

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
  setInterval(this.poll.bind(this), this.pollInterval);
}

PlantainAccessory.prototype.getHumidity = function () {
  return this.currentHumidity;
};

PlantainAccessory.prototype.getContactState = function () {
  return this.contactState;
};

PlantainAccessory.prototype.poll = function () {
  const url = `http://${this.ip}/api/sensors/data/last`;

  http.get(url, (res) => {
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
