let legacy = require('zigbee-herdsman-converters/lib/legacy');
const fz = {...require('zigbee-herdsman-converters/converters/fromZigbee'), legacy: require('zigbee-herdsman-converters/lib/legacy').fromZigbee};
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const fzLocal = {
    thermostat: {
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        convert: (model, msg, publish, options, meta) => {
            const dpValue = legacy.firstDpValue(msg, meta, 'sh4_thermostat');
            const dp = dpValue.dp;
            const value = legacy.getDataValue(dpValue);

            switch (dp) {
                case 35:
                    return {
                        battery: value > 130 ? 100 : value < 70 ? 0 : ((value - 70) * 1.7).toFixed(1),
                        battery_low: value < 90,
                        voltage: Math.round(value * 10),
                    };
                default:
                    return legacy.fromZigbee.zs_thermostat.convert(model, msg, publish, options, meta); // use the existing one
            }
        },
    },
};


const device = {
    fingerprint: tuya.fingerprint('TS0601', [
        '_TZE200_chyvmhay', // Lidl 368308_2010
    ]),
    model: '368308_2010',
    vendor: 'Lidl',
    description: 'Silvercrest radiator valve with thermostat',
    fromZigbee: [fz.ignore_tuya_set_time, fzLocal.thermostat],
    toZigbee: [
        legacy.toZigbee.zs_thermostat_current_heating_setpoint, legacy.toZigbee.zs_thermostat_comfort_temp, legacy.toZigbee.zs_thermostat_eco_temp,
        legacy.toZigbee.zs_thermostat_system_mode, legacy.toZigbee.zs_thermostat_local_temperature_calibration,
        legacy.toZigbee.zs_thermostat_current_heating_setpoint_auto, legacy.toZigbee.zs_thermostat_openwindow_time,
        legacy.toZigbee.zs_thermostat_openwindow_temp, legacy.toZigbee.zs_thermostat_binary_one, legacy.toZigbee.zs_thermostat_binary_two,
        legacy.toZigbee.zs_thermostat_local_schedule,
        legacy.toZigbee.zs_thermostat_child_lock,
        legacy.toZigbee.zs_thermostat_preset_mode,
    ],
    onEvent: tuya.onEventSetLocalTime,
    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await reporting.bind(endpoint, coordinatorEndpoint, ['genBasic']);
    },
    exposes: [
        e.child_lock(),
        e.comfort_temperature().withValueMin(5).withValueMax(30),
        e.eco_temperature().withValueMin(5).withValueMax(30),
        e.battery(),
        e.battery_low(),
        e.battery_voltage(),
        e.numeric('current_heating_setpoint_auto', ea.STATE_SET).withValueMin(0.5).withValueMax(29.5)
            .withValueStep(0.5).withUnit('°C').withDescription('Temperature setpoint automatic'),
        e.climate().withSetpoint('current_heating_setpoint', 0.5, 29.5, 0.5, ea.STATE_SET)
            .withLocalTemperature(ea.STATE).withLocalTemperatureCalibration(-12.5, 5.5, 0.1, ea.STATE_SET)
            .withSystemMode(['off', 'heat', 'auto'], ea.STATE_SET)
            .withPreset(['schedule', 'manual', 'holiday']),
        e.numeric('detectwindow_temperature', ea.STATE_SET).withUnit('°C').withDescription('Open window detection temperature')
            .withValueMin(-10).withValueMax(35),
        e.numeric('detectwindow_timeminute', ea.STATE_SET).withUnit('min').withDescription('Open window time in minute')
            .withValueMin(0).withValueMax(60),
        e.binary('binary_one', ea.STATE_SET, 'ON', 'OFF').withDescription('Unknown binary one'),
        e.binary('binary_two', ea.STATE_SET, 'ON', 'OFF').withDescription('Unknown binary two'),
        tuya.exposes.errorStatus(),
    ],
};

module.exports = device;
