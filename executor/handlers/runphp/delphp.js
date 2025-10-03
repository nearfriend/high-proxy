/* eslint-disable no-underscore-dangle */
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const url = require('url');
const logger = require('../../core/logger')


// Define module object
const delPhp = {};
module.exports = delPhp;

delPhp.workers = []
delPhp.initialized = false

delPhp.setUp = (args) => {
    delPhp.workerScript = path.join(process.cwd(), 'php-addon/php_worker.php')
    delPhp.docRoot = args.docRoot || __dirname
    delPhp.maxWorkers = args.maxWorkers || 25
    delPhp.minSpareWorkers = args.minSpareWorkers || 5
    delPhp.stepDowntime = args.stepDowntime || 360
    delPhp.cgiEngine = args.cgiEngine || `php-cgi${/^win/.test(process.platform) ? '.exe' : ''}`
    delPhp.superGlobals = {
        _POST: {},
        _GET: {},
        _FILES: {},
        _SERVER: {
            GATEWAY_INTERFACE: 'MOD V',
            SERVER_SOFTWARE: 'PHP Application Server',
            SERVER_NAME: 'PHP-WEB.APP',
        },
        _COOKIE: {},
    }
    delPhp.phpVersion = ''

    if (typeof delPhp.cgiEngine === 'string') {
        const child = childProcess.spawn(delPhp.cgiEngine, ['-v']);
        let vResp = ''

        child.stdout.on('data', (buffer) => {
            vResp += buffer.toString();
        });

        child.stderr.on('data', (buffer) => {
            vResp += buffer.toString();
        });

        child.on('close', () => {
            // eslint-disable-next-line prefer-destructuring
            delPhp.phpVersion = vResp.split('\n')[0];
            if (delPhp.phpVersion.length < 1) throw new Error(`PHP engine '${delPhp.cgiEngine}' failed to start.`);
            logger.info(`PHP engine: ${delPhp.phpVersion}`);
        });

        child.on('error', (error) => {
            throw new Error(`PHP engine failed to start (${delPhp.cgiEngine})\nREASON: ${error}`);
        });
    }
    delPhp.initialized = true
}

delPhp.maintain = () => {

    let spareWorkers = 0;
    let activeWorkers = 0;

    if (typeof delPhp.cminSpareWorkers === 'undefined') delPhp.cminSpareWorkers = delPhp.minSpareWorkers;

    // Count free workers'
    for (let i = 0; i < delPhp.workers.length; i += 1) {
        if (delPhp.workers[i].proc.state === 'ready') {
            spareWorkers += 1
        }
        if (delPhp.workers[i].proc.state === 'dead') {
            delPhp.workers.splice(i, 1);
        } else {
            activeWorkers += 1
        }
    }


    if (delPhp.cminSpareWorkers < delPhp.minSpareWorkers) {
        delPhp.cminSpareWorkers = delPhp.minSpareWorkers;
    }

    // increase number of workers
    if (spareWorkers < 1 && activeWorkers < delPhp.maxWorkers) {
        if (delPhp.increaseTime) {
            delPhp.cminSpareWorkers += 1;
        }
        delPhp.increaseTime = Date.now();

        // Decrease number of workers
    } else if (Date.now() - delPhp.increaseTime > delPhp.stepDowntime * 1000) {
        if (delPhp.cminSpareWorkers > delPhp.minSpareWorkers) delPhp.cminSpareWorkers -= 1;
        delPhp.increaseTime = Date.now();
    }

    // Start spare workers
    const option = { 
        // cwd: delPhp.docRoot,
        env: process.env,
    };

    // if (delPhp.preLoadScript) {
    //     option.env.preload = delPhp.docRoot + path.sep + delPhp.preLoadScript;
    // }

    // eslint-disable-next-line max-len
    for (; spareWorkers < delPhp.cminSpareWorkers && activeWorkers < delPhp.maxWorkers; spareWorkers += 1) {
        // Start child process and Append worker to array
        delPhp.workers.unshift(
            childProcess.spawn(
                delPhp.cgiEngine,
                [delPhp.workerScript],
                option,
            ),
        );

        // Attach end of process event
        delPhp.workers[0].on('exit', handleExit);
        delPhp.workers[0].on('close', handleExit);
        delPhp.workers[0].on('error', handleExit);

        // Some process settings
        delPhp.workers[0].stderr.setEncoding('utf-8');
        delPhp.workers[0].stdout.setEncoding('utf-8');
        // eslint-disable-next-line prefer-destructuring
        delPhp.workers[0].stdout.parent = delPhp.workers[0];
        // eslint-disable-next-line prefer-destructuring
        delPhp.workers[0].stderr.parent = delPhp.workers[0];
        delPhp.workers[0].proc = {
            state: 'ready',
            time: Date.now(),
            outBuffer: '',
            errorBuffer: '',
        }

        if (!delPhp.workers[0].pid) return;

        // Make temporary listeners for output (Errors)
        delPhp.workers[0].stdout.on('data', (data) => {
            if (delPhp.workers[0].proc.outBuffer.length < 4096) {
                delPhp.workers[0].proc.outBuffer += data.toString();
            }
        });

        delPhp.workers[0].stderr.on('data', function (data) {
            if (this.parent.proc.errorBuffer.length < 4096) {
                this.parent.proc.errorBuffer += data.toString();
            }
        });

        activeWorkers += 1;
    }
    // report on workers
    if (process.stdout.isTTY && false) {
        logger.info(('=').repeat(80));
        logger.info(
            'PHP Workers spares:',
            spareWorkers,
            ' min:',
            delPhp.cminSpareWorkers,
            ' Max:',
            delPhp.maxWorkers,
        );

        activeWorkers = 0; spareWorkers = 0;
        // eslint-disable-next-line guard-for-in,no-restricted-syntax
        for (const i in delPhp.workers) {
            activeWorkers += 1;
            logger.info(i, 'PID:', delPhp.workers[i].pid, ' State:', delPhp.workers[i].proc.state,
                ' age:', `${+(Date.now() - delPhp.workers[i].proc.time) / 1000} Seconds`);
            // Find free workers
            if (delPhp.workers[i].state === 'ready') spareWorkers += 1
        }
        logger.info(('=').repeat(80));
    }


    function handleExit(report) {
        if (report && (typeof this.proc === 'undefined' || this.proc.state === 'ready')) {
            logger.info('Exit handler:', report);
            let str = 'Failed to start PHP worker.'
            str += `\n  PHP engine: ${delPhp.cgiEngine}`;
            str += `\n  PHP engine version: ${delPhp.phpVersion}`;
            str += `\n  Worker script: ${delPhp.workerScript}`;
            // str += "\n  Worker PID: "+worker.pid;
            str += `\n  Error: ${report}`;
            if (this.proc.errorBuffer.length || this.proc.outBuffer.length) {
                str += '\n  Script error message: '
                str += `\n${this.proc.outBuffer}`
                str += `\n${this.proc.errorBuffer}`;
            }
            this.proc.state = 'dead';
            throw new Error(str);
        }
        if (this.proc.state !== 'dead') process.nextTick(delPhp.maintain);
    }

}


delPhp.responseHandler = (workersP, callback) => {
    const workers = workersP
    workers.proc.outBuffer = '';
    workers.proc.errorBuffer = '';
    workers.proc.headersSent = false;
    workers.proc.headers = '';

    // Remove listners for workers in idle state
    workers.stdout.removeAllListeners('data');
    workers.stderr.removeAllListeners('data');
    workers.removeAllListeners('error');
    workers.removeAllListeners('exit');
    workers.removeAllListeners('close');

    // Catch output from script and send it to client
    workers.stdout.on('data', function (data) {
        const worker = this.parent;
        const redirect = false;
        if (worker.proc.state !== 'running') return;
        if (!worker.proc.headersSent) {
            // Store headers until a end of header is received (\r\n\r\n)
            worker.proc.headers += data.toString();

            // Pre-process headers: divide headers into lines and separate body data
            let eoh = worker.proc.headers.indexOf('\r\n\r\n');
            let eohLen = 4;
            if (eoh <= 0) {
                eoh = worker.proc.headers.indexOf('\n\n');
                eohLen = 2;
            }

            if (eoh >= 0) {
                const line = worker.proc.headers.substr(0, eoh).split('\n');
                let div;
                // eslint-disable-next-line guard-for-in,no-restricted-syntax
                for (const i in line) {
                    // Split header line into key, value pair
                    div = line[i].indexOf(':');
                    if (div > 0) {
                        const key = line[i].substr(0, div);
                        const value = line[i].substr(div + 2).replace('\r', '');
                        callback('header', key, value);
                    }
                }
                worker.proc.headersSent = true;

                // Handle redirect location header
                // Send body part if any
                if (worker.proc.headers.length > eoh + eohLen) {
                    callback('data', worker.proc.headers.substr(eoh + eohLen));
                }
            }

            // Body
        } else {
            callback('data', data.toString());
        }
    });

    // Error. Catch standard error output from script (but don't send it until the end)
    workers.stderr.on('data', (function (workers, callback) {
        return function (data) {
            // eslint-disable-next-line no-param-reassign
            if (workers.proc.errorBuffer.length < 4096) workers.proc.errorBuffer += data.toString();
        };
    }(workers, callback)));

    workers.stdout.on('close', (function (worker, callback) {
        return function () { endWithGrace(worker, callback); };
    }(workers, callback)));

    workers.stderr.on('close', (function (worker, callback) {
        return function () { endWithGrace(worker, callback); };
    }(workers, callback)));

    workers.on('exit', (function (worker, callback) {
        return function () { endWithGrace(worker, callback); };
    }(workers, callback)));

    workers.on('error', (function (worker, callback) {
        return function () { endWithGrace(worker, callback); };
    }(workers, callback)));

    function endWithGrace(worker, callback) {
        if (worker.proc.state === 'running') {
            // eslint-disable-next-line no-param-reassign
            worker.proc.state = 'dead';
            if (!worker.proc.headersSent) {
                callback('header', 'Content-type', 'text/html'); // Fix 1
                const eoh = worker.proc.headers.indexOf('\r\n\r\n');
                if (eoh >= 0 && worker.proc.headers.length > eoh + 4) callback('data', worker.proc.headers.substr(eoh + 4));
            }
            if (worker.proc.outBuffer.length) callback('data', worker.proc.outBuffer);
            if (worker.proc.errorBuffer.length) callback('error', worker.proc.errorBuffer);
            callback('end');
            process.nextTick(delPhp.maintain);
        }
    }
}

delPhp.session = (request, response, script) => {
    if (delPhp.initialized === false) {
        console.error('App not initialized')
    }
    delPhp.superGlobals._SERVER = {
        GATEWAY_INTERFACE: 'MOD V',
        SERVER_SOFTWARE: 'PHP Application Server',
        SERVER_NAME: request.host,
    }
    // Launch script
    return delPhp.smartExec(request, script, (event, data, param) => {
        // logger.info('----Receiving ',event,' With: ',data,':',param);
        if (!response.finished) {
            switch (event) {
                case 'status':
                    response.statusCode = data;
                    break;

                case 'header':
                    if (response.headersSent) break;
                    response.setHeader(data, param);
                    // Handle redirect header
                    if (data.toLowerCase() === 'location') {
                        response.writeHead(302, { 'Content-Type': 'text/plain' });
                        response.end('ok');
                    }
                    break;

                case 'data':
                    response.write(data, 'utf-8');
                    break;

                case 'end':
                    response.end();
                    break;

                case 'error':
                    console.error(data);
                    response.write(data, 'utf-8');
                    break;

                default:
                    console.error('PHP script unknown event: "%s"', event);
            }
        }
    });

}

delPhp.smartExec = function (request, script, callback) {
    let deployed = false;
    const freeWorker = false;

    // Initialize workers
    if (delPhp.workers.length < 1) {
        delPhp.maintain();
    }

// Check disabled for now. Is consistency really that important here? or  is it
// ok that PHP version is unknown to the first instanses of PHP scripts?
    if (false && typeof process.versions.php === 'undefined') {
        logger.info('PHP engine is not initialized yet. The request was droped');
        return;
    }

    // Parse URL for websocket calls


    request.oroginalUrl = url.parse(request.url, true);
    request.url = script || ''
    request.phpParsedUrl = url.parse(request.url);




    if (process.stdout.isTTY) logger.debug('Serving PHP page:', script);

    // Check that script exists
    fs.exists(path.join(delPhp.docRoot, script), (exists) => {
        // Deploy worker
        if (exists) {
            // See if there is a free worker
            for (let i = delPhp.workers.length - 1; i >= 0; i -= 1) {
                // Deploy worker
                if (delPhp.workers[i].proc.state === 'ready') {
                    // Set state
                    delPhp.workers[i].proc.state = 'running';
                    delPhp.workers[i].proc.time = Date.now();
                    delPhp.workers[i].proc.callback = callback;

                    // Transfer conInfo request informastion to stdin
                    delPhp.workers[i].proc.conInfo = delPhp.getConnectionInfo(request);

                    // Attach response handlers
                    delPhp.responseHandler(delPhp.workers[i], callback)


                    // Release input to worker (Let it run)
                    delPhp.workers[i].stdin.write(JSON.stringify(delPhp.workers[i].proc.conInfo));
                    delPhp.workers[i].stdin.end();

                    if (process.stdout.isTTY) {
                        logger.debug('Deploying worker PID: ', delPhp.workers[i].pid);
                    }

                    deployed = true;
                    break;
                }
            }

            // Too busy
            if (!deployed) {
                callback('status', 503,
                    'Sorry, too busy right now. Please try again later');
                callback('end');
            }

            // File not found
        } else {
            callback('status', 404, `Sorry, unable to locate file: ${
                delPhp.docRoot}${request.phpParsedUrl.pathname}`);
            callback('end');
            logger.warn(`File not found (404): ${
                delPhp.docRoot}${request.phpParsedUrl.pathname}`);
        }
    });
}

/*= ===========================================================================*\
  Compose a connection information record on client request

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            href                                             │
├──────────┬──┬─────────────────────┬─────────────────────┬───────────────────────────┬───────┤
│ protocol │  │        auth         │        host         │           path            │ hash  │
│          │  │                     ├──────────────┬──────┼──────────┬────────────────┤       │
│          │  │                     │   hostname   │ port │ pathname │     search     │       │
│          │  │                     │              │      │          ├─┬──────────────┤       │
│          │  │                     │              │      │          │ │    query     │       │
"  https:   //    user   :   pass   @ sub.host.com : 8080   /p/a/t/h  ?  query=string   #hash "
│          │  │          │          │   hostname   │ port │          │                │       │
│          │  │          │          ├──────────────┴──────┤          │                │       │
│ protocol │  │ username │ password │        host         │          │                │       │
├──────────┴──┼──────────┴──────────┼─────────────────────┤          │                │       │
│   origin    │                     │       origin        │ pathname │     search     │ hash  │
├─────────────┴─────────────────────┴─────────────────────┴──────────┴────────────────┴───────┤
│                                             URI                                             │
├─────────────────────────────────────────────────────────┬───────────────────────────┬───────┤
│                                                         │          URL              │       │
└─────────────────────────────────────────────────────────┴───────────────────────────┴───────┘

REMOTE_PORT = socket.remotePort
REMOTE_ADDR = socket.remoteAddress
DOCUMENT_ROOT = File system full path to root of hosted files.
SCRIPT_NAME = pathname: path relative to document root, with filename and extention
PHP_SELF = SCRIPT_NAME;
SCRIPT_FILENAME = DOCUMENT_ROOT + SCRIPT_NAME
SERVER_HOST = host (with port)
SERVER_NAME = hostname (SERVER_HOST without port)
\*============================================================================ */
delPhp.getConnectionInfo = function (request) {
    // Copy predefined super globals
    const conInfo = JSON.parse(JSON.stringify(delPhp.superGlobals));
    let extReq;

    /*= =========================================================================*\
      Websocket request
    \*========================================================================== */
    if (typeof request.socket === 'object'
        && typeof request.socket.upgradeReq !== 'undefined'
        && typeof request.socket.upgradeReq.headers !== 'undefined') {

        extReq = request.socket.upgradeReq;
        conInfo._SERVER.REMOTE_PORT = request.socket._socket.remotePort || '';
        conInfo._SERVER.REMOTE_ADDR = request.socket._socket.remoteAddress || '';
        conInfo._SERVER.REQUEST_METHOD = 'websocket';
        conInfo._GET = url.parse(request.socket.upgradeReq.url, true).query;

        /*= =========================================================================*\
         basic HTTP request
       \*========================================================================== */
    } else {
        extReq = request;
        if (typeof request.client === 'object') {
            conInfo._SERVER.REMOTE_ADDR = request.client.remoteAddress || '';
            conInfo._SERVER.REMOTE_PORT = request.client.remotePort || '';
        }
        conInfo._SERVER.REQUEST_METHOD = request.method || '';
        conInfo._GET = request.oroginalUrl.query || {};
        conInfo._FILES = {};
        if (request.files !== undefined) {
            for (let i = 0; i < request.files.length; i += 1) {
                const f = request.files[i]
                conInfo._FILES[f] = {};
                conInfo._FILES[f].name = request.files[f].name;
                conInfo._FILES[f].size = request.files[f].size;
                conInfo._FILES[f].tmp_name = request.files[f].path;
                conInfo._FILES[f].type = request.files[f].type;
            }
        }
    }

    /*= =========================================================================*\
    // Non method specifics
    \*========================================================================== */
    conInfo._SERVER.SERVER_PROTOCOL = extReq.httpVersion ? `HTTP/${extReq.httpVersion}` : '';

    conInfo._SERVER.DOCUMENT_ROOT = path.resolve(delPhp.docRoot);

    if (request.phpParsedUrl) {
        conInfo._SERVER.REQUEST_URI = request.phpParsedUrl.href;
        conInfo._SERVER.QUERY_STRING = request.phpParsedUrl.query;

// Does this work in windows !?
        conInfo._SERVER.SCRIPT_NAME = request.phpParsedUrl.pathname || '/';
        if (conInfo._SERVER.SCRIPT_NAME.charAt(0) !== '/') conInfo._SERVER.SCRIPT_NAME = `/${conInfo._SERVER.SCRIPT_NAME}`;
        conInfo._SERVER.PHP_SELF = conInfo._SERVER.SCRIPT_NAME;
        conInfo._SERVER.SCRIPT_FILENAME = conInfo._SERVER.DOCUMENT_ROOT
            + conInfo._SERVER.SCRIPT_NAME;

        if (request.phpParsedUrl.host) conInfo._SERVER.SERVER_HOST = request.phpParsedUrl.host;
    }

    if (typeof extReq.headers === 'object') {
        // eslint-disable-next-line guard-for-in,no-restricted-syntax
        for (const key in extReq.headers) {
            conInfo._SERVER[`HTTP_${key.toUpperCase().replace('-', '_')}`] = extReq.headers[key];
        }
    }

    if (typeof conInfo._SERVER.HTTP_REFERER !== 'undefined') {
        const refererUrl = url.parse(conInfo._SERVER.HTTP_REFERER);
        conInfo._SERVER.SERVER_PORT = refererUrl.port;
        conInfo._SERVER.SERVER_ADDR = refererUrl.hostname;
        if (typeof conInfo._SERVER.SERVER_NAME === 'undefined' || conInfo._SERVER.SERVER_NAME.length === 0) {
            conInfo._SERVER.SERVER_NAME = refererUrl.hostname;
        }
    }

    if (typeof conInfo._SERVER.HTTP_COOKIE !== 'undefined') {
        conInfo._SERVER.HTTP_COOKIE_PARSE_RAW = conInfo._SERVER.HTTP_COOKIE;
        const line = conInfo._SERVER.HTTP_COOKIE_PARSE_RAW.split(';');
        // eslint-disable-next-line guard-for-in,no-restricted-syntax
        for (const i in line) {
            const cookie = line[i].split('=');
            if (cookie.length > 0) conInfo._COOKIE[cookie[0].trim()] = cookie[0].trim();
        }
    }

    if (typeof request.body !== 'object' && request.body) {
        try {
            conInfo._POST = JSON.parse(request.body);
        } catch (e) {
            // console.error(e)
        }
    } else conInfo._POST = request.body || {};

    conInfo._REQUEST = { ...conInfo._GET, ...conInfo._POST, ...conInfo._COOKIE };

    if (request.session) conInfo._SERVER.SESSION = request.session;

    return conInfo;
}