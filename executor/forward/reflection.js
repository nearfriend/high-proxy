const ClsMessageProxy = require('../handlers/mhandler')
const logger = require('../core/logger')


module.exports = (wsServerObj, contextStore) => {
    wsServerObj.on('request', (request) => {
        if (!originIsAllowed(request.origin)) {
            // Make sure we only accept requests from an allowed origin
            request.reject();
            logger.info(`${new Date()} Connection from origin ${request.origin} rejected.`)
            return;
        }

        const connection = request.accept('echo-protocol', request.origin);
        logger.info(`${new Date()} Connection accepted.`);
        startReflectionForJSClient(connection, contextStore)

        connection.on('close', (reasonCode, description) => {
            stopReflectionForJSClient(connection, contextStore)
        });
    });
}

function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed.
    return true;
}

const startReflectionForJSClient = (connectionObj, contextStore) => {
    const messageProxy = new ClsMessageProxy(connectionObj)
    contextStore.addNewPS(messageProxy)

    connectionObj.on('message', (message) => {
        if (message.type === 'utf8') {
            logger.info(`Received Message: ${message.utf8Data}`);
            connectionObj.sendUTF(message.utf8Data);
        } else if (message.type === 'binary') {
            logger.info(`Received Binary Message of ${message.binaryData.length} bytes`);
            connectionObj.sendBytes(message.binaryData);
        }
    })
}

const stopReflectionForJSClient = (connection, contextStore) => {
    logger.info(`${new Date()} Peer ${connection.remoteAddress} disconnected.`)
    /** SEND WS CLIENT CLOSE MSG TO wsClientObj */

    /** REMOVE PROCESS FROM STORAGE */
    contextStore.removePS('BUMP')
}
