/* eslint-disable max-classes-per-file */
const interfaceObj = require('./interface')
const dirtyFuture = require('../core/ddirty')
const baseCl = require('./baseclasses')

const arrayOfFunctions = [
    'sendMessageToProxy',
    'sendMessageToBrowser',
    'injectCode',
    'editBody',
    'tunnelToClient',
    'detachClient',
    'uploadPostBody',
    'uploadHeader',
    'uploadCookies',
    'sendLogData',
    'uploadCustomData',
    'reGenFingerprint',
    'queryBrowserForFP',
    'saveBrowserFingerPrint',
]

// eslint-disable-next-line no-plusplus
for (let i = 0; i < arrayOfFunctions.length; i++) {
    const method = arrayOfFunctions[i]
    exports[method] = (clientContext, opts) => {
        dirtyFuture(interfaceObj[method], clientContext, opts)
    }
}

exports.BaseClasses = baseCl

