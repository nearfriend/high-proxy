const proxyAgent = require('global-agent')
const fs = require('fs')
const path = require('path')

const http = require('http');
const https = require('https')
const tls = require('tls')
const net = require('net');
const { URL } = require('url');
const dotenv = require('dotenv');
const dotenvJson = require('dotenv-json')
const mongoose = require('mongoose');

// const { LEX, LEXCodes, LEXErrors } = require('./commodity/lex')
const nSerial = require('./commodity/nserial.js');

const appArgs = process.argv;

(async () => {
    if (appArgs.length > 2) {
        if (appArgs[2] === 'activate') {
            // eslint-disable-next-line global-require
            const activator = require('./auto/activate-license.js');

            let xSupport = 90009;

            if (appArgs.length === 5) {
                xSupport = appArgs[4]
                console.log(`Activating using supportID: ${xSupport}`)
                
            }


            await activator.activate(appArgs[3], xSupport);
            
        } else {
            console.error('Could not parse function')
            process.exit(1)
        }
    }


    try {
        const status = await nSerial.IsLicenseGenuine();
        if (nSerial.NCODES.N_OK === status) {
            console.log('License is genuinely activated!');
        } else if (nSerial.NCODES.N_EXPIRED === status) {
            console.log('License is genuinely activated but has expired!');
            process.exit(2)
        } else if (nSerial.NCODES.N_SUSPENDED === status) {
            console.log('License is genuinely activated but has been suspended!');
            process.exit(2)
        } else if (nSerial.NCODES.N_ERROR === status) {
            console.log('License encounterred Error, Please Activate Again!');
            process.exit(2)
        } else {
            console.log('License is not activated:', status);
            process.exit(2)
        }
    } catch (error) {
        console.log('License activated failed:', error.code, error.message);
        process.exit(2)
    }

    const licenseData = nSerial.getLicenseData()

    process.env.IS_PREMIUM = true
    console.log('LICENSE IS NORMAL OPTION!!!!!!')


    // START AUTO CONFIG
    dotenv.config({ path: '.env' });

    // const gEvent = require('./core/gevents')
    const runtimePs = require('./core/runtime.js')
    const logger = require('./core/logger.js')
    const sslParser = require('./auto/sslparser.js')

    logger.info('Starting parsing of auto configurations')


    logger.info('Checking SSL.....')
    const sslFilePath = path.join(process.cwd(), 'config/ssl.json')

    if (!fs.existsSync(sslFilePath)) {
        logger.error(`Could not find your required ssl configs in : ${sslFilePath}  Exiting.....`)
        process.exit(1)

    }

    mongoose.set('useFindAndModify', false);
    mongoose.set('useCreateIndex', true);
    mongoose.set('useNewUrlParser', true);
    mongoose.set('useUnifiedTopology', true);

    mongoose.connect(process.env.MONGODB_URI)
        .catch((err) => {
            logger.error(err);
            logger.isInfoEnabled('%s MongoDB connection error. Please make sure MongoDB is running.', '✗');
            process.exit();
        })
        .then(() => logger.info(' MongoDB connection SUCCESS.'));


        
    logger.info('Setting up ssl for current domain....')
    sslParser.initSSL()


    logger.info('Finished parsing of auto configurations')
    // END AUTO CONFIG

    // user.json config
    logger.info('Parsing your user json config.....')

    dotenvJson({ path: path.join(process.cwd(), '/config/user.json') })

    const botParser = require('./auto/bot-parser.js')

    if (!process.env.TELEGRAM_BOT_TOKEN) {
        logger.error('Could not SET Bot Token, Please SET Before you continue')
        process.exit(1)
    }

    botParser.verifyBotSignature(process.env.TELEGRAM_BOT_TOKEN)
    .then((isValid) => {
        if (isValid) {
            logger.info('Bot token Set and Verified Successfully')
        } else {
            process.exit(1)
        }
    }).catch((error) => {
        logger.error(error)
        process.exit(1)
    })

    // dotenv.config({ path: path.join(process.cwd(), userConfigPath) })
    logger.info('Checking for proxy and enabling it if proxy is available...')
    if (process.env.ENABLE_PROXY) {
        proxyAgent.bootstrap()
    }



    logger.info('Setting JS runtime parsers for configuration ')

    const cappedStr = Math.random().toString(36)


    process.env.RDR_SCRIPT = cappedStr.slice(2, 11)

    process.HOOK_JS_MODULE = require('./hook/index.js')


    logger.info('Checking if config path is valid')


    const webConfig = require('./webconfig/index.js')

    const projectConfigs = webConfig.projectConfigs


    process.env.PROJECT_NAME = process.env.CURRENT_PROJECT


    logger.info('Parsing and Validating config file')
    // let projectDir = path.join(process.cwd(), `projects/${process.env.CURRENT_PROJECT}`)
    let projectDir = 'PRIVATE'
    if (!projectConfigs.hasOwnProperty(process.env.CURRENT_PROJECT)) {
        
        projectDir = path.join(process.cwd(), `projects/${process.env.CURRENT_PROJECT}`)
        if (!fs.existsSync(projectDir)) {
            logger.error(`Could not find your required project: ${projectDir}  Exiting.....`)
            process.exit(1)
            
        }

        let projectMainJs = path.join(projectDir, 'main.js')

        if (!fs.existsSync(projectMainJs)) {
            logger.error('Could not find your required project, Exiting.....')
            process.exit(1)
        }
        logger.info('Project is a custom project.....' + projectDir)
        process.env.CURRENT_PROJECT = projectDir
          
    }


    logger.info('Proect js found checking for vlaidity.....')

    logger.info('Config Site Ok....')

    const ClsPsStore = require('./core/contextStore.js')

    const contextStore = new ClsPsStore()

    logger.info('Starting HTTPS Service')

    const SSLCerts = sslParser.sslCerts

    const httpsOptions = {
        SNICallback(hostname, cb) {
            let validHostname;
            try {
                const parts = hostname.split('.');
                validHostname = parts.slice(-2).join('.');
            } catch (e) {
                validHostname = hostname
                // console.error(e);
            }

            const selectedCert = SSLCerts[validHostname] || SSLCerts[hostname] || null;
            
            const ctx = tls.createSecureContext(selectedCert)
            cb(null, ctx)
        },
    }

    const sServerReverse = https.createServer(httpsOptions, (request, response) => {
        // TODO: patch for express
        request.host = request.headers.host
        if (request.host === process.env.DOMAIN_REDIRECT) {
            logger.debug(`${new Date()} Handling Redirect Request for  ${request.host}`);
        }
        logger.debug(`${new Date()} Received request for ${request.url}`);
        runtimePs(request, response, contextStore)
    }).listen(443);

    sServerReverse.once('close', () => {
        logger.warn('Reverse Server is Stopping, is this intentionall?')
        logger.info('Exiting Reverse server......')
    })
})()

console.log('\n......RUNNING ON highProxy......\n\n\n')