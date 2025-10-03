/* eslint-disable no-useless-escape */
const { parse } = require('querystring');
const superagent = require('superagent');

const logger = require('../core/logger')

exports.getChallengeHtml = () => {
    let SITE_KEY
    if (process.env.TURNSTILE_DATA) {
        // eslint-disable-next-line prefer-destructuring
        SITE_KEY = process.env.TURNSTILE_DATA.split(';')[0]
    } else {
        SITE_KEY = ''
    }

    const TURNSTILE_TEXT_HTML = `
<!doctype html><html lang=en-US><head> <script async defer src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback">
<\/script> <title>Just a moment...</title> <meta content="width=device-width,initial-scale=1" name=viewport> <script>var verifyCallback_CF=function (response){var cfForm=document.querySelector("#cfForm"); if (response && response.length > 10){cfForm.submit(); return;}}; window.onloadTurnstileCallback=function (){turnstile.render("#turnstileCaptcha",{sitekey: "${SITE_KEY}", callback: verifyCallback_CF,});};
<\/script></head><style>.h1,.h2{font-weight:500}*{box-sizing:border-box;margin:0;padding:0}html{line-height:1.15;-webkit-text-size-adjust:100%;color:#313131;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji}body{display:flex;flex-direction:column;min-height:100vh}a{transition:color .15s;background-color:transparent;text-decoration:none;color:#0051c3}a:hover{text-decoration:underline;color:#ee730a}.main-content{margin:8rem auto;width:100%;max-width:60rem}.footer,.main-content{padding-right:1.5rem;padding-left:1.5rem}.main-wrapper{display:flex;flex:1;flex-direction:column;align-items:center}.spacer{margin:2rem 0}.h1{line-height:3.75rem;font-size:2.5rem}.core-msg,.h2{line-height:2.25rem;font-size:1.5rem}.core-msg{font-weight:400}.body-text{line-height:1.25rem;font-size:1rem;font-weight:400}.icon-wrapper{display:inline-block;position:relative;top:.25rem;margin-right:.2rem}.heading-icon{width:1.625rem;height:1.625rem}.warning-icon{display:inline-block}.text-center{text-align:center}.footer{margin:0 auto;width:100%;max-width:60rem;line-height:1.125rem;font-size:.75rem}.footer-inner{border-top:1px solid #d9d9d9;padding-top:1rem;padding-bottom:1rem}.core-msg,.zone-name-title{overflow-wrap:break-word}@media (max-width:720px){.main-content{margin-top:4rem}.h1{line-height:1.75rem;font-size:1.5rem}.core-msg,.h2{line-height:1.5rem}.h2{font-size:1.25rem}.core-msg{font-size:1rem}.heading-icon{width:1.25rem;height:1.25rem}.zone-name-title{margin-bottom:1rem}}@keyframes lds-ring{0%{transform:rotate(0)}to{transform:rotate(360deg)}}@media screen and (-ms-high-contrast:active),screen and (-ms-high-contrast:none){.main-wrapper,body{display:block}}@media (prefers-color-scheme:dark){body{background-color:#222;color:#d9d9d9}a{color:#fff}a:hover{text-decoration:underline;color:#ee730a}}</style>
<body class=no-js> <div class=main-wrapper role=main> <div class=main-content> <h1 class="h1 zone-name-title"> <div> <img src="" style=margin-bottom:-17px> <div id=site-name>Just a moment.....</div></div></h1> <p data-translate=please_wait id=cf-spinner-please-wait> Please stand by, while we are checking if the site connection is secure </p><br/> <form data-callback=verifyCallback_CF id=cfForm method=POST style=visibility:visible> <div id=turnstileCaptcha></div><br></form> <div class="core-msg spacer" id=challenge-body-text> 
<div>We needs to review the security of your connection before proceeding. </div></div></div></div><div class=footer role=contentinfo> <div class=footer-inner> <div class=text-center> Performance & Security </div></div></div>`

    return TURNSTILE_TEXT_HTML
}


exports.verifyChallenge = (req, cBack) => {

    let SECRET_KEY
    if (process.env.TURNSTILE_DATA) {
        // eslint-disable-next-line prefer-destructuring
        SECRET_KEY = process.env.TURNSTILE_DATA.split(';')[1]
    } else {
        SECRET_KEY = ''
    }

    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const postData = parse(body);
        const captchaResponse = postData['cf-turnstile-response'];
        
        if (!captchaResponse) {
            // res.end('No captcha response received');
            return cBack(false)
        }

        return superagent
            .post('https://challenges.cloudflare.com/turnstile/v0/siteverify')
            .type('form')
            .send({
                secret: SECRET_KEY,
                response: captchaResponse,
                remoteIp: req.connection.remoteAddress,
            })
            .end((err, response) => {
                if (err) {
                    logger.warn('Failed to verify captcha');
                    return cBack(false)
                }

                if (response.body.success) {
                    logger.debug('Captcha verified successfully');
                    return cBack(true)
                } 

                logger.warn('Failed to verify captcha');
                return cBack(false)
                
            });
    })
}