const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');

const device = {
    fingerprint: tuya.fingerprint('TS0601', [
        // https://github.com/Koenkk/zigbee-herdsman-converters/issues/1803
        '_TZE200_fhn3negr', // Moes SH4-ZB

        // https://github.com/Koenkk/zigbee2mqtt/issues/10850
        // https://github.com/Koenkk/zigbee2mqtt/issues/18933
        // https://github.com/Koenkk/zigbee2mqtt/issues/6211
        '_TZE200_zion52ef', // Moes SH4-ZB

        // https://github.com/Koenkk/zigbee2mqtt/issues/14239
        // https://github.com/Koenkk/zigbee2mqtt/issues/5332
        '_TZE200_i48qyn9s' // Essential ESS-HK-TRV-6102
    ]),
    model: 'Zigbee TRV',
    vendor: 'Tuya',
    description: 'Zigbee Radiator Thermostat',
    whiteLabel: [
        {vendor: 'Moes', model: 'SH4-ZB'},
        {vendor: 'Essential', model: 'ESS-HK-TRV-6102'},
    ],
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tuya.tz.datapoints],
    onEvent: tuya.onEventSetLocalTime,
    configure: tuya.configureMagicPacket,
    exposes: [
        e.battery(), e.child_lock(), e.open_window(),
        e.open_window_temperature().withValueMin(5).withValueMax(30),
        e.comfort_temperature().withValueMin(5).withValueMax(30),
        e.eco_temperature().withValueMin(5).withValueMax(30),
        e.numeric('auto_setpoint_override', ea.STATE_SET)
            .withUnit('°C').withValueMax(30)
            .withValueMin(0.5)
            .withValueStep(0.5)
            .withDescription('Setpoint override in auto mode'),
        e.climate()
            .withSystemMode(['off', 'heat', 'auto'], ea.STATE_SET)
            .withPreset(['auto', 'manual', 'holiday'])
            .withLocalTemperatureCalibration(-5, 5, 0.1, ea.STATE_SET)
            .withLocalTemperature(ea.STATE)
            .withSetpoint('current_heating_setpoint', 0, 30, 0.5, ea.STATE_SET),
        e.binary('online', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('The current data request from the device.'),
        e.binary('boost_heating', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Boost Heating: the device will enter the boost heating mode.'),
        e.numeric('boost_timeset_countdown', ea.STATE_SET).withUnit('s').withDescription('Setting ' +
            'minimum 0 - maximum 900 seconds boost time. The boost (â¨) function is activated. The remaining ' +
            'time for the function will be counted down in seconds ( 900 to 0 ).').withValueMin(0).withValueMax(900),
        e.numeric('window_detection', ea.STATE_SET).withUnit('m').withDescription('Open Window timer').withValueMin(0).withValueMax(60),
        tuya.exposes.errorStatus()
    ],
    meta: {
        tuyaDatapoints: [
            // GitHib issue: https://github.com/Koenkk/zigbee-herdsman-converters/issues/1803
            // sniffing eTRV -> Gateway: https://gist.github.com/serrj-sv/964d390139534754b6ea22f628b33c61
            // sniffing Gateway -> eRTV: https://gist.github.com/serrj-sv/e6680647c438221b190a2b4d96805cc4
            // legacy exteranl converter: https://gist.github.com/serrj-sv/af142b25de2d7ac54c3a2eb2623d9a6d
            [2, 'preset', tuya.valueConverterBasic.lookup({'auto': tuya.enum(0), 'manual': tuya.enum(1), 'holiday': tuya.enum(2)})],
            [16, 'current_heating_setpoint', tuya.valueConverterBasic.divideBy(2)],
            [24, 'local_temperature', tuya.valueConverter.divideBy10],
            [30, 'child_lock', tuya.valueConverter.lockUnlock],
            [34, 'battery', tuya.valueConverterBasic.scale(0, 100, 50, 150)],
            [45, 'error_status', tuya.valueConverter.raw],
            [101, 'comfort_temperature', tuya.valueConverterBasic.divideBy(2)],
            [102, 'eco_temperature', tuya.valueConverterBasic.divideBy(2)],
            [103, null, null], // sh4VacationPeriod
            [104, 'local_temperature_calibration', tuya.valueConverter.localTempCalibration1],
            [106, 'boost_heating', tuya.valueConverter.onOff],
            [105, 'auto_setpoint_override', tuya.valueConverterBasic.divideBy(2)],
            [107, 'open_window', tuya.valueConverter.onOff],
            [108, null, null], // sh4Hibernate (don't know what it does)
            [109, null, null], // sh4ScheduleMon - WIP
            [110, null, null], // sh4ScheduleTue - WIP
            [111, null, null], // sh4ScheduleWed - WIP
            [112, null, null], // sh4ScheduleThu - WIP
            [113, null, null], // sh4ScheduleFri - WIP
            [114, null, null], // sh4ScheduleSat - WIP
            [115, null, null], // sh4ScheduleSun - WIP
            [116, 'open_window_temperature', tuya.valueConverterBasic.divideBy(2)],
            [117, 'window_detection', tuya.valueConverter.raw], // sh4OpenWindowTime
            [118, 'boost_timeset_countdown', tuya.valueConverter.raw],
            [119, null, null], // sh4TempControl (don't know what it does)
            [120, 'online', tuya.valueConverter.onOffNotStrict],
        ],
    },
};

module.exports = device;
