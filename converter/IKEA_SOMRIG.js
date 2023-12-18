const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const utils = require('zigbee-herdsman-converters/lib/utils');
const ota = require('zigbee-herdsman-converters/lib/ota');
const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const e = exposes.presets;
const ea = exposes.access;

const fzLocal = {
    ikea_dots_click_v2_somrig: {
        cluster: 'tradfriButton',
        type: ['commandAction1', 'commandAction2', 'commandAction3', 'commandAction4', 'commandAction6'],
        convert: (model, msg, publish, options, meta) => {
            const button = utils.getFromLookup(msg.endpoint.ID, {1: '1', 2: '2'});
            const lookup = {
                commandAction1: 'initial_press',
                commandAction2: 'long_press',
                commandAction3: 'short_release',
                commandAction4: 'long_release',
                commandAction6: 'double_press',
            };
            const action = lookup[msg.type] ?? lookup[msg.type.toLowerCase()] ?? lookup[msg.type.toUpperCase()];
            return {action: `${button}_${action}`};
        }
    },
}

const definition = {
    zigbeeModel: ['SOMRIG shortcut button'],
    model: 'E2213',
    vendor: 'IKEA',
    description: 'SOMRIG shortcut button',
    fromZigbee: [fz.battery, fzLocal.ikea_dots_click_v2_somrig],
    toZigbee: [tz.battery_percentage_remaining],
    ota: ota.tradfri,
    exposes: [
        e.battery().withAccess(ea.STATE_GET), e.action(['dots_1_initial_press',
            'dots_2_initial_press', 'dots_1_long_press', 'dots_2_long_press',
            'dots_1_short_release', 'dots_2_short_release', 'dots_1_long_release']),
    ],
    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint1 = device.getEndpoint(1);
        const endpoint2 = device.getEndpoint(2);
        await reporting.bind(endpoint1, coordinatorEndpoint, ['tradfriButton', 'genPollCtrl']);
        await reporting.bind(endpoint2, coordinatorEndpoint, ['tradfriButton']);
        await reporting.batteryVoltage(endpoint1);
    },
};

module.exports = definition;
