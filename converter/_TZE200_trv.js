let legacy = require('zigbee-herdsman-converters/lib/legacy');
const fz = {...require('zigbee-herdsman-converters/converters/fromZigbee'), legacy: require('zigbee-herdsman-converters/lib/legacy').fromZigbee};
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const globalStore = require('zigbee-herdsman-converters/lib/store');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require("zigbee-herdsman-converters/lib/tuya");

const tuyaLocal = {
    dataPoints: {
        sh4Mode: 2,
        sh4HeatingSetpoint: 16,
        sh4LocalTemp: 24,
        sh4ChildLock: 30,
        sh4Battery: 34,
        sh4FaultCode: 45,
        sh4ComfortTemp: 101,
        sh4EcoTemp: 102,
        sh4VacationPeriod: 103,
        sh4TempCalibration: 104,
        sh4ScheduleTempOverride: 105,
        sh4RapidHeating: 106,
        sh4WindowStatus: 107,
        sh4Hibernate: 108,
        sh4ScheduleMon: 109,
        sh4ScheduleTue: 110,
        sh4ScheduleWed: 111,
        sh4ScheduleThu: 112,
        sh4ScheduleFri: 113,
        sh4ScheduleSat: 114,
        sh4ScheduleSun: 115,
        sh4OpenWindowTemp: 116,
        sh4OpenWindowTime: 117,
        sh4RapidHeatCntdownTimer: 118,
        sh4TempControl: 119,
        sh4RequestUpdate: 120,
    },
};

const fzLocal = {
    sh4_thermostat: {
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        convert: (model, msg, publish, options, meta) => {
            const dpValue = legacy.firstDpValue(msg, meta, 'sh4_thermostat');
            const dp = dpValue.dp;
            const value = legacy.getDataValue(dpValue);

            switch (dp) {
                case tuyaLocal.dataPoints.sh4Mode: // 2
                    // 0-Schedule; 1-Manual; 2-Away
                    if (value == 0) {
                        return {
                            system_mode: 'auto',
                            away_mode: 'OFF',
                            current_heating_setpoint: meta.state.schedule_heating_setpoint_override
                        };
                    } else if (value == 1) {
                        return {
                            system_mode: 'heat',
                            away_mode: 'OFF',
                            current_heating_setpoint: meta.state.manual_heating_setpoint
                        };
                    } else if (value == 2) {
                        return {
                            system_mode: 'off',
                            away_mode: 'ON',
                            current_heating_setpoint: -1 // need implement read away_preset_temperature
                        };
                    }
                case tuyaLocal.dataPoints.sh4RequestUpdate: // 120
                    break;
                case tuyaLocal.dataPoints.sh4ChildLock: // 30
                    return {child_lock: value ? 'LOCK' : 'UNLOCK'};
                case tuyaLocal.dataPoints.sh4Battery: // 34
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

const tzLocal = {
    sh4_thermostat_preset_mode: {
        key: ['preset'],
        convertSet: async (entity, key, value, meta) => {
            const lookup = {'schedule': 0, 'manual': 1, 'holiday': 2, 'boost': 7};
            await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4Mode, lookup[value]);
            if (value == 'manual') {
                const temp = globalStore.getValue(entity, 'current_heating_setpoint');
                await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4HeatingSetpoint, temp ? Math.round(temp * 2) : 43);
            }
        },
    },

    sh4_thermostat_child_lock: {
        key: ['child_lock'],
        convertSet: async (entity, key, value, meta) => {
            await tuya.sendDataPointBool(entity, tuyaLocal.dataPoints.sh4ChildLock, value === 'LOCK');
        },
    },
};

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
    fromZigbee: [fz.ignore_tuya_set_time, fzLocal.sh4_thermostat],
    toZigbee: [
        legacy.toZigbee.zs_thermostat_current_heating_setpoint, legacy.toZigbee.zs_thermostat_comfort_temp, legacy.toZigbee.zs_thermostat_eco_temp,
        legacy.toZigbee.zs_thermostat_system_mode, legacy.toZigbee.zs_thermostat_local_temperature_calibration,
        legacy.toZigbee.zs_thermostat_current_heating_setpoint_auto, legacy.toZigbee.zs_thermostat_openwindow_time,
        legacy.toZigbee.zs_thermostat_openwindow_temp, legacy.toZigbee.zs_thermostat_binary_one, legacy.toZigbee.zs_thermostat_binary_two,
        legacy.toZigbee.zs_thermostat_local_schedule,
        tzLocal.sh4_thermostat_child_lock, // use local
        tzLocal.sh4_thermostat_preset_mode // use local
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
