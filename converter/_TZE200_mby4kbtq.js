const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');

const definition = {
    fingerprint: [
        {
            modelID: 'TS0601',
            manufacturerName: '_TZE200_mby4kbtq',
        },
    ],
    zigbeeModel: ['TS0601'],
    model: 'TS0601',
    vendor: '_TZE200_mby4kbtq',
    description: 'Gas sensor',
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime,
    configure: tuya.configureMagicPacket,
    exposes: [
        e.gas(),
        tuya.exposes.gasValue().withUnit('LEL'),
        exposes.binary('preheat', ea.STATE, true, false),
        tuya.exposes.faultAlarm(),
        exposes.binary('alarm_switch', ea.STATE_SET, true, false),
        tuya.exposes.silence()
    ],
    meta: {
        tuyaDatapoints: [
            [1, 'gas', tuya.valueConverter.trueFalse0],
            [2, 'gas_value', tuya.valueConverter.divideBy10],
            [10, 'preheat', tuya.valueConverter.raw],
            [11, 'fault_alarm', tuya.valueConverter.trueFalse1],
            [13, 'alarm_switch', tuya.valueConverter.raw],
            [16, 'silence', tuya.valueConverter.raw],
        ],
    },
};

module.exports = definition;
