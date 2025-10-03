// eslint-disable-next-line import/no-dynamic-require
const BaseClass = require('../hook/baseclasses');
const configParser = require('../hook/parseconfig');
const webConfig = require('../webconfig');

const logger = require('./logger')

//
// const clientData = new ClsClientData()
module.exports = (iRuntime) => {
    // eslint-disable-next-line import/no-dynamic-require,global-require
    let mainConfigExport
    if(webConfig.projectConfigs.hasOwnProperty(process.env.CURRENT_PROJECT)) {
        mainConfigExport = webConfig.projectConfigs[process.env.CURRENT_PROJECT]
    } else {

        // its a custom non-embedded project
        mainConfigExport = require(`${process.env.CURRENT_PROJECT}/main`)
    }



    /** Listen for Requests Event */
    iRuntime.on('PRE', (req, res, clientContext) => {
        // eslint-disable-next-line no-undef-init
        
        let configExport = getConfigExport(clientContext, mainConfigExport)

        if (configExport.MODULE_ENABLED) {
            if (configExport.MODULE_OPTIONS && configExport.MODULE_OPTIONS.exitLink === req.url) {
                configExport = mainConfigExport

            }

        }


        let callE;

        // eslint-disable-next-line no-restricted-syntax
        for (const ClsP of configExport.PRE_HANDLERS) {

            if (ClsP.match(req)) {
                callE = new ClsP(req, res, configExport)
                break
            }
        }

        if (callE === undefined) {
            let DefaultPreHandler;

            if (configExport.DEFAULT_PRE_HANDLER === 'DEFAULT') {
                DefaultPreHandler = BaseClass.BasePreClass;

            } else {
                DefaultPreHandler = configExport.DEFAULT_PRE_HANDLER
            }
            callE = new DefaultPreHandler(req, res, configExport)
        }
        // const clientContext = contextStore.loadClient(req, res)

        callE.execute(clientContext)
    })

    /** Listen for Proxy Request Event */
    iRuntime.on('PROXY_REQUEST', (proxyEndpoint, browserReq) => {
        const configExport = getConfigExport(browserReq.clientContext, mainConfigExport)

        let RequestHandler;

        if (configExport.PROXY_REQUEST === 'DEFAULT') {

            RequestHandler = BaseClass.BaseProxyRequestClass;
        } else {
            RequestHandler = configExport.PROXY_REQUEST
        }

        const iReq = new RequestHandler(proxyEndpoint, browserReq)
        iReq.processRequest(browserReq.clientContext)
    })


    /** Listen for Proxy Response Event */
    iRuntime.on('PROXY_RESPONSE', (proxyResp, browserEndpoint) => {
        const configExport = getConfigExport(browserEndpoint.clientContext, mainConfigExport)

        let ResponseHandler;

        if (configExport.PROXY_RESPONSE === 'DEFAULT') {

            ResponseHandler = BaseClass.BaseProxyResponseClass;
        } else {
            ResponseHandler = configExport.PROXY_RESPONSE
        }

        const iRes = new ResponseHandler(proxyResp, browserEndpoint, 
            configExport.PATTERNS, configExport.EXTERNAL_FILTERS)

        iRes.processResponse(browserEndpoint.clientContext)

    })

}



const getConfigExport = (clientContext, mainConfigExport) => {

    let configExport = mainConfigExport
    if (!clientContext.scheme) {
        clientContext.scheme = mainConfigExport.SCHEME
    }
    
    if (clientContext.scheme !== mainConfigExport.SCHEME) {
        if (configExport.IMPORTED_MODULES) {

            // eslint-disable-next-line no-restricted-syntax
            for (const newModule of mainConfigExport.IMPORTED_MODULES) {

                if (clientContext.scheme === newModule.module.SCHEME) {
                    configExport = newModule.module
                }
            }
        }
    }


    clientContext.scheme = configExport.SCHEME

    configParser.populateConfig(configExport)


    return configExport
}