const legacy = require('zigbee-herdsman-converters/lib/legacy');
const fz = {...require('zigbee-herdsman-converters/converters/fromZigbee'), legacy: require('zigbee-herdsman-converters/lib/legacy').fromZigbee};
const tz = {...require('zigbee-herdsman-converters/converters/toZigbee'), legacy: require('zigbee-herdsman-converters/lib/legacy').toZigbee};
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const extend = require('zigbee-herdsman-converters/lib/extend');
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

            function weeklySchedule(day, value) {
                // byte 0 - Day of Week (0~7 = Mon ~ Sun) <- redundant?
                // byte 1 - 1st period Temperature (1~59 = 0.5~29.5°C (0.5 step))
                // byte 2 - 1st period end time (1~96 = 0:15 ~ 24:00 (15 min increment, i.e. 2 = 0:30, 3 = 0:45, ...))
                // byte 3 - 2nd period Temperature
                // byte 4 - 2nd period end time
                // ...
                // byte 16 - 8th period end time
                // byte 17 - 9th period Temperature
                const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
                // we get supplied in value only a weekday schedule, so we must add it to
                // the weekly schedule from meta.state, if it exists
                const weeklySchedule = meta.state.hasOwnProperty('weekly_schedule') ? meta.state.weekly_schedule : {};
                meta.logger.info(JSON.stringify({'received day': day, 'received values': value}));
                let daySchedule = []; // result array
                for (let i = 1; i < 18 && value[i]; ++i) {
                    const aTemp = value[i];
                    ++i;
                    const time = value[i];
                    daySchedule = [...daySchedule, {
                        temperature: Math.floor(aTemp / 2),
                        hour: Math.floor(time / 4),
                        minute: time % 4 * 15,
                    }];
                }
                meta.logger.info(JSON.stringify({'returned weekly schedule: ': daySchedule}));
                return {'weekly-schedule': {...weeklySchedule, [weekDays[day]]: daySchedule}};
            }

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
                    ;
                    break;
                case tuyaLocal.dataPoints.sh4HeatingSetpoint: // 16
                    // 0 - Valve full OFF, 60 - Valve full ON : only in "manual" mode
                    return {
                        manual_heating_setpoint: (value / 2).toFixed(1),
                        current_heating_setpoint: (value / 2).toFixed(1)
                    };
                case tuyaLocal.dataPoints.sh4LocalTemp: // 24
                    return {local_temperature: (value / 10).toFixed(1)};
                case tuyaLocal.dataPoints.sh4ChildLock: // 30
                    return {child_lock: value ? 'LOCKED' : 'UNLOCKED'};
                case tuyaLocal.dataPoints.sh4Battery: // 34
                    return {
                        battery: value > 130 ? 100 : value < 70 ? 0 : ((value - 70) * 1.7).toFixed(1),
                        battery_low: value < 90,
                    };
                case tuyaLocal.dataPoints.sh4FaultCode: // 45
                    break;
                case tuyaLocal.dataPoints.sh4ComfortTemp: // 101
                    return {comfort_temp_preset: (value / 2).toFixed(1)};
                case tuyaLocal.dataPoints.sh4EcoTemp: // 102
                    return {eco_temp_preset: (value / 2).toFixed(1)};
                case tuyaLocal.dataPoints.sh4VacationPeriod: // 103
                    return {
                        away_data: {
                            year: value[0] + 2000,
                            month: value[1],
                            day: value[2],
                            hour: value[3],
                            minute: value[4],
                            temperature: (value[5] / 2).toFixed(1),
                            away_hours: value[6] << 8 | value[7],
                        },
                    };
                // byte 0 - Start Year (0x00 = 2000)
                // byte 1 - Start Month
                // byte 2 - Start Day
                // byte 3 - Start Hour
                // byte 4 - Start Minute
                // byte 5 - Temperature (1~59 = 0.5~29.5°C (0.5 step))
                // byte 6-7 - Duration in Hours (0~2400 (100 days))
                case tuyaLocal.dataPoints.sh4TempCalibration: // 104
                    return {
                        local_temperature_calibration: value > 55 ?
                            ((value - 0x100000000) / 10).toFixed(1) : (value / 10).toFixed(1)
                    };
                case tuyaLocal.dataPoints.sh4ScheduleTempOverride: // 105
                    if (meta.state.system_mode == 'auto') {
                        return {
                            schedule_heating_setpoint_override: (value / 2).toFixed(1),
                            current_heating_setpoint: (value / 2).toFixed(1)
                        }
                    } else {
                        return {schedule_heating_setpoint_override: (value / 2).toFixed(1)}
                    }
                case tuyaLocal.dataPoints.sh4RapidHeating: // 106
                    break;
                case tuyaLocal.dataPoints.sh4WindowStatus: // 107
                    break;
                case tuyaLocal.dataPoints.sh4Hibernate: // 108
                    break;
                case tuyaLocal.dataPoints.sh4ScheduleMon: // 109
                    return weeklySchedule(0, value);
                case tuyaLocal.dataPoints.sh4ScheduleTue: // 110
                    return weeklySchedule(1, value);
                case tuyaLocal.dataPoints.sh4ScheduleWed: // 111
                    return weeklySchedule(2, value);
                case tuyaLocal.dataPoints.sh4ScheduleThu: // 112
                    return weeklySchedule(3, value);
                case tuyaLocal.dataPoints.sh4ScheduleFri: // 113
                    return weeklySchedule(4, value);
                case tuyaLocal.dataPoints.sh4ScheduleSat: // 114
                    return weeklySchedule(5, value);
                case tuyaLocal.dataPoints.sh4ScheduleSun: // 115
                    return weeklySchedule(6, value);
                case tuyaLocal.dataPoints.sh4OpenWindowTemp: // 116
                    break;
                case tuyaLocal.dataPoints.sh4OpenWindowTime: // 117
                    break;
                case tuyaLocal.dataPoints.sh4RapidHeatCntdownTimer: // 118
                    break;
                case tuyaLocal.dataPoints.sh4TempControl: // 119
                    break;
                case tuyaLocal.dataPoints.sh4RequestUpdate: // 120
                    break;
                default:
                    meta.logger.warn(`zigbee-herdsman-converters:sh4Thermostat: NOT RECOGNIZED DP #${dp} with data ${JSON.stringify(msg.data)}`);
            }
        },
    },
};

const tzLocal = {
    sh4_thermostat_current_heating_setpoint: {
        key: ['current_heating_setpoint'],
        convertSet: async (entity, key, value, meta) => {
            const temp = Math.round(value * 2);
            if (meta.state.system_mode == 'heat') {
                await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4HeatingSetpoint, temp);
            } else if (meta.state.system_mode == 'auto') {
                await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4ScheduleTempOverride, temp);
            }
        },
        convertGet: async (entity, key, value, meta) => {
            await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4RequestUpdate, 0);
        },
    },
    sh4_thermostat_comfort_temp_preset: {
        key: ['comfort_temp_preset'],
        convertSet: async (entity, key, value, meta) => {
            const temp = Math.round(value * 2);
            await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4ComfortTemp, temp);
        },
    },
    sh4_thermostat_eco_temp_preset: {
        key: ['eco_temp_preset'],
        convertSet: async (entity, key, value, meta) => {
            const temp = Math.round(value * 2);
            await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4EcoTemp, temp);
        },
    },
    sh4_thermostat_schedule_override_setpoint: {
        key: ['schedule_override_setpoint'],
        convertSet: async (entity, key, value, meta) => {
            const temp = Math.round(value * 2);
            await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4ScheduleTempOverride, temp);
        },
    },
    sh4_thermostat_get_data: {
        key: ['local_temperature'],
        convertGet: async (entity, key, value, meta) => {
            await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4RequestUpdate, 0);
        },
    },
    sh4_thermostat_mode: {
        key: ['system_mode'],
        convertSet: async (entity, key, value, meta) => {
            if (value == 'auto') {
                await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4Mode, 0);
            } else if (value == 'heat') {
                await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4Mode, 1);
            } else if (value == 'off') {
                await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4Mode, 2);
                //await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4HeatingSetpoint, 0);
            }
        },
        convertGet: async (entity, key, value, meta) => {
            await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4RequestUpdate, 0);
        },
    },
    sh4_thermostat_away: {
        key: ['away_mode', 'away_data'],
        convertSet: async (entity, key, value, meta) => {
            if (key === 'away_mode') {
                if (value == 'ON') {
                    await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4Mode, 2);
                } else {
                    await tuya.sendDataPointEnum(entity, tuyaLocal.dataPoints.sh4Mode, 0);
                }
            } else if (key === 'away_data') {
                const output = new Buffer(8);
                // byte 0 - Start Year (0x00 = 2000)
                // byte 1 - Start Month
                // byte 2 - Start Day
                // byte 3 - Start Hour
                // byte 4 - Start Minute
                // byte 5 - Temperature (1~59 = 0.5~29.5°C (0.5 step))
                // byte 6-7 - Duration in Hours (0~2400 (100 days))
                output[0] = value.year > 2000 ? value.year - 2000 : value.year; // year
                output[1] = value.month; // month
                output[2] = value.day; // day
                output[3] = value.hour; // hour
                output[4] = value.minute; // min
                output[5] = Math.round(value.temperature * 2);
                output[7] = value.away_hours & 0xFF;
                output[6] = value.away_hours >> 8;
                meta.logger.info(JSON.stringify({'send to tuya': output, 'value was': value, 'key was': key}));
                await legacy.sendDataPointRaw(entity, tuyaLocal.dataPoints.sh4VacationPeriod, output);
            }
        },
    },
    sh4_thermostat_schedule: {
        key: ['weekly_schedule'],
        convertSet: async (entity, key, value, meta) => {
            const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
            // byte 0 - Day of Week (0~7 = Mon ~ Sun) <- redundant?
            // byte 1 - 1st period Temperature (1~59 = 0.5~29.5°C (0.5 step))
            // byte 2 - 1st period end time (1~96 = 0:15 ~ 24:00 (15 min increment, i.e. 2 = 0:30, 3 = 0:45, ...))
            // byte 3 - 2nd period Temperature
            // byte 4 - 2nd period end time
            // ...
            // byte 16 - 8th period end time
            // byte 17 - 9th period Temperature
            // we overwirte only the received days. The other ones keep stored on the device
            const keys = Object.keys(value);
            for (const dayName of keys) { // for loop in order to delete the empty day schedules
                const output = new Buffer(17); // empty output byte buffer
                const dayNo = weekDays.indexOf(dayName);
                output[0] = dayNo + 1;
                const schedule = value[dayName];
                schedule.forEach((el, Index) => {
                    if (Index <= 8) {
                        output[1 + 2 * Index] = Math.round(el.temperature * 2);
                        output[2 + 2 * Index] = el.hour * 4 + Math.floor((el.minute / 15));
                    } else {
                        meta.logger.warn('more than 8 schedule points supplied for week-day ' + dayName +
                            ' additional schedule points will be ignored');
                    }
                });
                await legacy.sendDataPointRaw(entity, tuyaLocal.dataPoints.sh4ScheduleMon + dayNo, output);
                await new Promise((r) => setTimeout(r, 2000));
                // wait 2 seconds between schedule sends in order not to overload the device
            }
        },
    },
    sh4_thermostat_child_lock: {
        key: ['child_lock'],
        convertSet: async (entity, key, value, meta) => {
            await tuya.sendDataPointBool(entity, tuyaLocal.dataPoints.sh4ChildLock,
                ['LOCKED', 'ON', 'LOCK'].includes(value.toUpperCase()));
        },
    },
    sh4_thermostat_calibration: {
        key: ['local_temperature_calibration'],
        convertSet: async (entity, key, value, meta) => {
            if (value > 0) value = value * 10;
            if (value < 0) value = value * 10 + 0x100000000;
            await legacy.sendDataPointValue(entity, tuyaLocal.dataPoints.sh4TempCalibration, value);
        },
    },
};

const device = {
    fingerprint: [
        {
            modelID: 'TS0601',
            manufacturerName: '_TZE200_fhn3negr'
        },
        {
            modelID: 'TS0601',
            manufacturerName: '_TZE200_zion52ef' // MOES
        },
        {
            modelID: 'TS0601',
            manufacturerName: '_TZE200_i48qyn9s' // Lidl
        },
    ],
    model: 'SH4 Zigbee eTRV',
    vendor: 'Tuya',
    description: 'Zigbee Radiator Thermostat',
    fromZigbee: [
        fz.ignore_basic_report,
        fzLocal.sh4_thermostat,
    ],
    toZigbee: [
        tzLocal.sh4_thermostat_current_heating_setpoint,
        tzLocal.sh4_thermostat_comfort_temp_preset,
        tzLocal.sh4_thermostat_eco_temp_preset,
        tzLocal.sh4_thermostat_away,
        tzLocal.sh4_thermostat_mode,
        tzLocal.sh4_thermostat_child_lock,
        tzLocal.sh4_thermostat_calibration,
        tzLocal.sh4_thermostat_schedule_override_setpoint,
        tzLocal.sh4_thermostat_schedule,
        tzLocal.sh4_thermostat_get_data,
        tz.legacy.tuya_data_point_test,
    ],
    onEvent: tuya.onEventSetLocalTime,
    exposes: [
        e.battery(), e.battery_low(), e.child_lock(),
        exposes.climate().withSetpoint('current_heating_setpoint', 0.5, 29.5, 0.5)
            .withLocalTemperature()
            .withSystemMode(['auto', 'heat', 'off'])
    ],
};

module.exports = device;
