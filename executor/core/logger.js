const path = require('path')
const winston = require('winston')

const joinPath = (fN) => path.join(process.cwd(), fN);


const transports = {
    console: new winston.transports.Console({ level: 'debug' }),
    // debug_file: new winston.transports
    // .File({ filename: joinPath(process.env.DEBUG_FILE), level: 'debug' }),
    // log_file: new winston.transports
    // .File({ filename: joinPath(process.env.LOG_FILE), level: 'info' }),
};

const logger = winston.createLogger({
    transports: [
        transports.console,
        // transports.debug_file,
        // transports.log_file,
    ],
});

module.exports = logger