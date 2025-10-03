module.exports = class MessageProxy {

    constructor(browser) {
        this.serverProxy = null
        this.browserProxy = browser
    }

    setServerProxy(server) {
        this.serverProxy = server
    }

    setBrowserPRoxy(browser) {
        this.browserProxy = browser
    }

    deliverToBrowser() {

    }
}