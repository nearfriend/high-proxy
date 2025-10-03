const net = require('net');
const http = require('http');
// const msgPack = require('@msgpack/msgpack')
const WebSocket = require('ws');
const urlParser = require('url-parse')
const ipcVars = require('./ipcvars')
const logger = require('../../core/logger')



class IpcServer {

    constructor(contextStore) {
        this.contextStore = contextStore;

        this.clientSockets = {}
        this.serverHttp = null
        this.relayAdminWs = null
        this.initialized = false

    }

    relayInit() {
        logger.info('Starting IPC Services')
        this.setupServerSocket()
        this.setupRelaySocket()
        this.checkForDisconnects()
        logger.info('Started IPC Services')
    }
    
    authRelayConnection(request, cB) {
        const urlObj = urlParser(request.url)
        if (urlObj.pathname === `/second/third/in${process.env.ADMIN_SID}`) {
            cB(1)
        } else if (urlObj.pathname === '/js/browser') {
            cB(2)
        } else {

            cB(-1)
        }
    }

    setupRelaySocket() {
        this.serverHttp = http.createServer();

        const wsServer = new WebSocket.Server({ noServer: true });
        // intiReflectionProtocol(this.relayAdminWs, contextStore)

        this.serverHttp.on('upgrade', (request, socket, head) => {
            this.authRelayConnection(request, (returnValue) => {
                if (returnValue < 1) {
                    return socket.destroy()
                }
                if (returnValue === 1) {
                    wsServer.handleUpgrade(request, socket, head, (ws) => {
                        if (this.relayAdminWs !== null) {
                            this.relayAdminWs.terminate()
                        }
                        this.initServerMsgHandler(ws)

                    });
                    return 0
                    
                } if (returnValue === 2) {
                    logger.warn('Client Connections not yet implemented')
                    return 0
                }
                
                socket.write('HTTP/1.1 401 Unknown\r\n\r\n');
                socket.destroy();
                return 0
                
            });
        });
    }

    initServerMsgHandler(ws) {
        this.relayAdminWs = ws
        this.relayAdminWs.on('message', (data) => {
            logger.info('Received Message From Admin Client')

        })
        this.relayAdminWs.on('close', () => {

            logger.warn('Admin disconnected from his socket')
            this.relayAdminWs = null

        })
    }

    setupServerSocket() {
        this.serverSock = net.createServer();
        this.serverSock.listen(parseInt(process.env.IPC_PORT, 10), '127.0.0.1', () => {
            logger.info('TCP Server is running on live {   }.');
        });
        this.serverSock.on('connection', this.clientSockConnected)

    }

    checkForDisconnects() {

    }

    clientSockConnected(clientSock) {
        clientSock.on('message', (data) => {
            logger.debug('Received IPC Message, Processing it')
            this.onClientMessage(clientSock, data)
        })
        clientSock.on('close', () => {
            logger.debug('Closing Connection Of Client Socket')
        })
    }

    onClientMessage(clientSock, data) {

        const msgObj = msgPack.decode(data)
        switch (msgObj.CODE) {
            case ipcVars.CLIENT_1_REGISTER:
                this.registerClientSocket(msgObj, clientSock)
                break
            case ipcVars.CLIENT_1_ACTION:
                break
            case ipcVars.CLIENT_1_CLOSE:
                break

            default:
                console.warn('Unknown MSG Received')

        }

    }

    onClientClose(clientSock) {

    }

    onRelayMessage(relaySock) {

    }

    onRelayClose() {

    }

    registerClientSocket(msgObj, clientSock) {
        logger.info('Registering New clientSock for IPC communication')

    }
}

module.exports = IpcServer