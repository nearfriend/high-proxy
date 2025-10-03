const logger = require('../core/logger')
/* eslint-disable no-param-reassign */
exports.captureWSServer = (wsServerObj) => {
    wsServerObj.onerror = () => {
        console.log('Connection Error');
    };

    wsServerObj.onopen = () => {

    };

    wsServerObj.onclose = () => {
        logger.warn('echo-protocol Client Closed');
    };
}
