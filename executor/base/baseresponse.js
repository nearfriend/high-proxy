const path = require('path')
const Q = require('q')
const Url = require('url')

const urlParse = require('url-parse')
const cheerio = require('cheerio')
const format = require('string-template')

const iUtils = require('../core/agentutil')
const dDirty = require('../core/ddirty')
const logger = require('../core/logger')
const cipher = require('../core/urlcipher')
const interfaceObj = require('../hook/interface')

class BaseResponse {

    /**
     * This is handled automatically by our gEvent
     * @param {object} proxyResp 
     * @param {object} browserEndPoint 
     * @param {Array} externalFilters 
     */
    constructor(proxyResp, browserEndPoint, patterns, externalFilters) {
        this.proxyResp = proxyResp;
        this.browserEndPoint = browserEndPoint;
        this.patterns = patterns || [];
        this.externalFilters = externalFilters || []

        this.clientContext = browserEndPoint.clientContext

    }

    /**
     * Checks if the response is a redirect and returns the the url modified to for rdirect
     * @returns {obect}  {code: boolean url: string}
     */
    getExternalRedirect() {
        const redirectCodes = /^201|30(1|2|3|7|8)$/
        if (!redirectCodes.test(this.proxyResp.statusCode)) {
            return null
        }
        const fullRedirectStr = this.proxyResp.headers.location || ''
        const redirectCap = `https://${this.clientContext.hostname}/?${process.env.RDR_SCRIPT}=`
        if (!fullRedirectStr.includes(redirectCap)) {
            return null
        }
        const urlList = fullRedirectStr.split(redirectCap)
        const urlQueryB4 = urlList[1] || ''
        const urlQuery = Buffer.from(urlQueryB4, 'base64').toString('ascii')
        if (urlQuery === null) {
            return null
        }

        return {
            code: this.proxyResp.statusCode,
            url: urlQuery,
        }

    }

    /**
     * Prepares the response for handling
     * Preparing the response includes the following
     * -decompress body
     * -if autoUpdateLinks: then update all the links to use reverse proxy links
     * @param {boolean} autoUpdateLinks 
     * @returns promise of the body
     */
    async superPrepareResponse(autoUpdateLinks) {
        // eslint-disable-next-line dot-notation
        // if (this.proxyResp.headers['location']) {
        //     // eslint-disable-next-line dot-notation
        //     const locationUrl = this.proxyResp.headers['location'] || ''
        //     console.log('Got cipher redirect: ', locationUrl)

        //     const parsedLocation = urlParse(locationUrl);
                

        //     if (parsedLocation.hostname === null 
        //         || parsedLocation.hostname === this.clientContext.hostname) {
        // eslint-disable-next-line max-len
        //             const redirectPath = cipher.makeCipherUrl(`${parsedLocation.pathname}${parsedLocation.query}`, this.clientContext)
        //             console.log('new redirect path is ', redirectPath)
        //             this.browserEndPoint.setHeader('location', redirectPath)
                    
        //         }
        //     // eslint-disable-next-line dot-notation
            
        // }

        const edgeOfNow = Q.defer()
        let parsedBody

        iUtils.deCompressBody(this.proxyResp)
            .then((decodedBody) => {
                if (autoUpdateLinks) {
                    parsedBody = iUtils.updateProxyLinks(decodedBody, this.clientContext)
                    if (this.externalFilters.length > 0) { 
                        parsedBody = iUtils.updateExternalFilters(parsedBody, 
                            this.externalFilters, this.clientContext)
                    }
                }
               
                edgeOfNow.resolve(parsedBody)

            }).catch((err) => {
            console.error(err)
            edgeOfNow.reject(err)
        })
        return edgeOfNow.promise
    }

    /**
     * This is called after prepare response incase you want to manually edit the body
     * then call this function to compress back the body and send
     * @param {string} parsedBody body of the request
     */
    superFinishResponse(parsedBody) {
        /** We Set the Content Length After Editing the request */

        const finalBody = parsedBody; // this.cipherAndUpdateLinks(parsedBody)

        
        const seType = this.proxyResp.headers['content-encoding'] || 'plain'
        const transferType = this.proxyResp.headers['transfer-encoding'] || 'identity'
        if (transferType !== 'chunked') {
            if (seType === 'plain') {
                this.browserEndPoint.setHeader('content-length', Buffer.byteLength(finalBody, 'utf8'))
            } else {
                this.browserEndPoint.setHeader('content-length', Buffer.byteLength(finalBody))
            }
        }
        iUtils.compressBackBody(seType, finalBody)
            .pipe(this.browserEndPoint)
    }

    replacePatterns(msgBody) {
        const reqDomain = this.proxyResp.req.host || ''

        const { clientContext } = this

        let updatedMsgBody = msgBody;

        for (let i = 0; i < this.patterns.length; i += 1) {
            const regExObj = this.patterns[i]
            let matchStr = regExObj.match
            if (typeof matchStr === 'object') {
                matchStr = matchStr.toString()
            }

            const matchFormatted = format(matchStr, {
                HOSTNAME: clientContext.hostname,
                DOMAIN: clientContext.currentDomain,
            })

            const replaceFormatted = format(regExObj.replace, {
                HOSTNAME: clientContext.hostname,
                DOMAIN: clientContext.currentDomain,
            })


            const matchRegex = new RegExp(matchFormatted, 'gi')


            if (regExObj.domain) {
                if (regExObj.domain === reqDomain) {
                    if (matchRegex.test(updatedMsgBody)) {
                        updatedMsgBody = updatedMsgBody.replace(matchRegex, replaceFormatted)
                    }
                }
            } else {
                // eslint-disable-next-line no-lonely-if

                if (matchRegex.test(updatedMsgBody)) {
                    updatedMsgBody = updatedMsgBody.replace(matchRegex, replaceFormatted)
                }
            }
        }
        return updatedMsgBody
    }

    cipherAndUpdateLinks(msgBody) {

        const contentType = this.proxyResp.headers['content-type'] || ''
        if (contentType.indexOf('text/html') <= -1) {
            return msgBody
        }
        
        let $
        try {
            $ = cheerio.load(msgBody)
        } catch (e) {
            console.log(e) // handle error
            return msgBody
        }

        let isModified = false
        let modifiedHtml = msgBody

        $('*').each((index, element) => {
            const attributes = ['href', 'src', 'action'];
          
            attributes.forEach((attribute) => {
              const urlValue = $(element).attr(attribute);
              if (urlValue) {
                console.log('trying to cipher url: ', urlValue)
                const parsedUrl = urlParse(urlValue);

                if (parsedUrl.hostname === null 
                    || parsedUrl.hostname === this.clientContext.hostname) {
                    const cipheredUrl = cipher.makeCipherUrl(parsedUrl.pathname, this.clientContext)
                    parsedUrl.pathname = cipheredUrl;

                    const finalUrlStr = parsedUrl.toString()

                    console.log(`ciphered url: for ${urlValue} is \n\n ${finalUrlStr}`)
                    $(element).attr(attribute, finalUrlStr);

                    isModified = true;
                    
                }
                
              }

            });
        });
          
        modifiedHtml = $.html();
        return modifiedHtml;

    }


    /**
     * This does both superPrepareResponse and superFinishResponse
     * @param {boolean} autoUpdateLinks 
     * @param {string} linkUrl can be null
     * @returns null
     */
    deployResponse(autoUpdateLinks = true, linkUrl = null) {
        

        if (this.proxyResp.headers['content-length'] < 1) {
            return this.proxyResp.pipe(this.browserEndPoint)
        }
        let newMsgBody
        return this.superPrepareResponse(autoUpdateLinks, linkUrl)
            .then((msgBody) => {
                newMsgBody = this.replacePatterns(msgBody)

                this.superFinishResponse(newMsgBody)
            }).catch((err) => {
            console.error(err)
        })

    }

    /**
     * This does everything automatically and calls deployResponse
     * This is the fucntion you should call for automated work
     */
    processResponse(clientContext) {
        this.clientContext = clientContext

        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')
       
        if (this.proxyResp.headers['content-length'] < 1) {
             this.proxyResp.pipe(this.browserEndPoint)
             return
        }

        const extRedirect = this.getExternalRedirect()
        if (extRedirect !== null) {
            this.proxyResp.headers.location = extRedirect.url
            // this.proxyResp.pipe(this.browserEndPoint)

        }
        this.deployResponse()


        
    }
}

module.exports = BaseResponse;