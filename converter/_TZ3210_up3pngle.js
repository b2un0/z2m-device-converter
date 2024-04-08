const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const e = exposes.presets;

const definition = {
    fingerprint: [{modelID: 'TS0205', manufacturerName: '_TZ3210_up3pngle'}],
    model: 'YG400A',
    vendor: 'TuYa',
    description: 'Smoke sensor',
    fromZigbee: [fz.ias_smoke_alarm_1, fz.battery, fz.ignore_basic_report],
    toZigbee: [],
    configure: async (device, coordinatorEndpoint, logger) => {
        try {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
            //await reporting.batteryVoltage(endpoint);
        } catch (error) {/* Fails for some*/
        }
    },
    exposes: [e.smoke(), e.battery_low(), e.battery(), e.tamper()],
    whiteLabel: [
        {vendor: 'Tesla Smart', model: 'TSL-SEN-SMOKE'},
        {vendor: 'Dongguan Daying Electornics Technology', model: 'YG400A'},
    ],
};

module.exports = definition;