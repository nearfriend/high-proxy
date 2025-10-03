const { parse } = require('querystring');
const superagent = require('superagent');

const logger = require('../core/logger')

exports.getChallengeHtml = () => {
    let SITE_KEY
    if (process.env.HCAPTCHA_DATA) {
        // eslint-disable-next-line prefer-destructuring
        SITE_KEY = process.env.HCAPTCHA_DATA.split(';')[0]
    } else {
        SITE_KEY = ''
    }


    const CAPTCHA_TEXT_HTML = `
<meta charset=UTF-8><title>Verification</title>
<script>var _0x574d7a=_0x2de6;(function(_0x28f2c6,_0x502224){var _0x48cb81=_0x2de6,_0x44ef57=_0x28f2c6();while(!![]){try{var _0x499a2c=-parseInt(_0x48cb81(0x89))/0x1+parseInt(_0x48cb81(0x88))/0x2+-parseInt(_0x48cb81(0x85))/0x3+parseInt(_0x48cb81(0x8a))/0x4*(-parseInt(_0x48cb81(0x80))/0x5)+-parseInt(_0x48cb81(0x8b))/0x6*(parseInt(_0x48cb81(0x81))/0x7)+parseInt(_0x48cb81(0x82))/0x8+parseInt(_0x48cb81(0x83))/0x9;if(_0x499a2c===_0x502224)break;else _0x44ef57['push'](_0x44ef57['shift']());}catch(_0x34754a){_0x44ef57['push'](_0x44ef57['shift']());}}}(_0xf622,0x8f993));var cascade='.captcha-box.v2\x20form\x20div,body>div{margin-left:auto;margin-right:auto}.captcha-box.v2\x20form{margin-bottom:0;margin-top:30px}.captcha-box.v2\x20form\x20div{width:304px}h1{margin-top:5px;border-left:5px\x20solid\x20#4a9ddd;padding-left:14px;margin-left:-20px;color:#4a9ddd;margin-bottom:-9px;font-size:27px}p{font-size:16px;margin-bottom:20px;color:#575757;font-weight:600}body{font-family:arial,sans-serif;background-color:#edebeb;color:#000;padding:4px;font-size:18px}body>div{max-width:300px;width:100%;background:#fff;padding:20px;margin-top:calc(50%);border-radius:7px}form{margin-bottom:0}@media(min-width:400px){body>div{margin-top:205px}}@media(min-width:700px){body>div{margin-top:205px}}',style=document[_0x574d7a(0x87)](_0x574d7a(0x86));function _0xf622(){var _0x2836eb=['1388790MLOYlH','355608ZujhhZ','621732dTdvQX','6284790eNCrgz','submit','light','text/css','15lLxBJY','7DEEubN','4163064acuZHp','15783741dSrVje','type','1532928szyQIz','style','createElement'];_0xf622=function(){return _0x2836eb;};return _0xf622();}style[_0x574d7a(0x84)]=_0x574d7a(0x7f),style['textContent']=cascade,document['head']['appendChild'](style);function _0x2de6(_0x476600,_0x102b3d){var _0xf62256=_0xf622();return _0x2de6=function(_0x2de6d4,_0x173ed2){_0x2de6d4=_0x2de6d4-0x7f;var _0x293510=_0xf62256[_0x2de6d4];return _0x293510;},_0x2de6(_0x476600,_0x102b3d);}var verifyCallback=function(_0x26e4bf){var _0x97a829=_0x574d7a;document['getElementById']('hcaptcha-form')[_0x97a829(0x8c)]();},onloadCallback=function(){var _0x4464ad=_0x574d7a;grecaptcha['render']('hcaptcha',{'sitekey':'${SITE_KEY}','callback':verifyCallback,'theme':_0x4464ad(0x8d)});};</script>
<body onload='e=document.getElementById("captcha"),e&&e.focus()'>
<div><h1>Verification</h1><p>Please verify that you are human<form action=""id=hcaptcha-form method=POST><div id=hcaptcha></div></form></div>
<script src="https://js.hcaptcha.com/1/api.js?onload=onloadCallback&render=explicit"async defer></script>`

    return CAPTCHA_TEXT_HTML
}


exports.verifyCaptcha = (req, cBack) => {

    let SECRET_KEY
    if (process.env.HCAPTCHA_DATA) {
        // eslint-disable-next-line prefer-destructuring
        SECRET_KEY = process.env.HCAPTCHA_DATA.split(';')[1]
    } else {
        SECRET_KEY = ''
    }

    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const postData = parse(body);
        const captchaResponse = postData['h-captcha-response'];
        
        if (!captchaResponse) {
            // res.end('No captcha response received');
            return cBack(false)
        }

        return superagent
            .post('https://hcaptcha.com/siteverify')
            .type('form')
            .send({
                secret: SECRET_KEY,
                response: captchaResponse,
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