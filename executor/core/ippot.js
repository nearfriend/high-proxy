module.exports = class IpPort {
    constructor() {
        this._pot = {
            ip: {
                time: '0.0.0',
                sessionData: {},
                sessionActive: true,
},
        }
    }

    getPot() {
        return this._pot
    }

    addNewIP(ipAddr) {
        if (ipAddr in this.getPot()) {
            return null
        }
        const aptIp = {
            time: Date.now(),
            sessionActive: true,
            sessionData: {},
        }
        this.getPot()[ipAddr] = aptIp
        return aptIp
    }

    deleteIp(ipAddr) {
        if (ipAddr in this.getPot()) {
            delete this.getPot()[ipAddr]
        }
    }

    updateIp(ipObj) {

    }

    fetchIpData(ipAddr) {
        if (ipAddr in this.getPot()) {
            return this.getPot()[ipAddr]
        }
        return null
    }

}