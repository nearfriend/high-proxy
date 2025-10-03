const { Buffer } = require('buffer');
const urlParse = require('url-parse');
const zlib = require('zlib');
const { Readable, Writable } = require('stream');



exports.updateProxyLinks = (ctBody, clientContext) => {
    let proxyUrl = clientContext.currentDomain
    if (proxyUrl.startsWith('www.')) {
        proxyUrl = proxyUrl.slice(4)
    }
    // return ctBody
    // eslint-disable-next-line
    const proxyRegex = new RegExp(`(http(s)?:\\/\\/)([a-zA-Z0-9-]*?).?${proxyUrl}`, 'gi')
    const trailingSlash = ctBody.replace(proxyRegex, `$1${clientContext.hostname}/sub--$3/${process.env.SUBDOMAIN_CHAR}`)
    const trailingWWW = trailingSlash.replace(/\/\/~\/?/gi, '/');
    const perfected = trailingWWW.replace(/\/sub--\/~\/?/gi, '/')
    return perfected
}

exports.updateExternalFilters = (ctBody, externalFilters, clientContext) => {
 
    let parsedBody = ctBody
    externalFilters.forEach((externUrl) => {
        const proxyRegex = new RegExp(`(http(s)?:\\/\\/)?(${externUrl})`, 'gi')
        const trailingSlash = parsedBody.replace(proxyRegex, `$1${clientContext.hostname}/$3/${process.env.SUBDOMAIN_CHAR}`)
        parsedBody = trailingSlash.replace(/\/\/~\/?/gi, '/');
    })
    return parsedBody
}

const convertUrlHostToProxy = (hostUrl, agentConfig) => {
    const parsedUrl = urlParse(hostUrl)
    let retParse
    if (parsedUrl.host === '') {
        retParse = hostUrl
    } else {
        retParse = parsedUrl.host
    }
    // let useTls
    let convertedUrl
    const useTls = parsedUrl.protocol === 'https';

    if (hostUrl.includes(agentConfig.hostDomain)) {
        convertedUrl = hostUrl.replace(agentConfig.hostDomain, agentConfig.proxyDomain)
    } else {
        convertedUrl = hostUrl
    }
    return convertedUrl
}

const convertUrlProxyToHost = (proxyLinkStr, agentConfig) => {
    let linkStr = proxyLinkStr
    if (!linkStr.startsWith('https://') || !linkStr.startsWith('http://')) {
        linkStr = `https://${linkStr}`
    }
    const urlObj = urlParse(linkStr)
    const hostStr = urlObj.host
    if (linkStr.includes(agentConfig.proxyDomain)) {
        const subDm = hostStr.replace(`.${agentConfig.proxyDomain}`, '')
        /** Check subdomain* */
        // if (subDm.length > 0) {}
        return linkStr.replace(`${agentConfig.proxyDomain}`, agentConfig.hostDomain)
    }
    return linkStr
}

exports.deCompressBody = (response) => {
    let buffedBody
    let plain
    const cEnc = response.headers['content-encoding'] || 'plain'
    switch (cEnc) {
        case 'x-gzip':
        case 'gzip':
            buffedBody = zlib.createGunzip()
            break
        case 'deflate':
            buffedBody = zlib.createDeflate()
            break
        case 'br':
            buffedBody = zlib.createBrotliDecompress()
            break
        case 'plain':
        default:
            plain = true
    }
    return new Promise((resolve, reject) => {
        let cloVa = ''
        if (plain === true) {
            buffedBody = response
        } else {
            response.pipe(buffedBody)
        }
        buffedBody.on('data', (chunk) => {
            cloVa += chunk.toString('utf8')
        })
        buffedBody.on('end', () => {
            resolve(cloVa)
        })
        buffedBody.on('error', (e) => {
            reject(e)
        })

    })
}

exports.compressBackBody = (seType, cData) => {
    let compressedBody
    const streamUtf = new Readable()
    streamUtf.push(cData)
    streamUtf.push(null)
    let plain = false
    switch (seType) {
        case 'x-gzip':
        case 'gzip':
            compressedBody = zlib.createGzip()
            break
        case 'deflate':
            compressedBody = zlib.createDeflate()
            break
        case 'br':
            compressedBody = zlib.createBrotliCompress()
            break
        case 'plain':
        default:
            plain = true
    }
    return plain ? streamUtf : streamUtf.pipe(compressedBody)
}

exports.workOnQuery = (req, res) => {

}

