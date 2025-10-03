const fs = require('fs');
const path = require('path');


exports.betterReadFile = (filePath) => {
    const filePathFull = path.join(process.cwd(), filePath);
    if (!fs.existsSync(filePathFull)) {
        return false
    }
    return fs.readFileSync(filePathFull);
}


exports.betterWriteFile = (filePath, fileContent) => {
    const filePathFull = path.join(process.cwd(), filePath);
    
    return fs.writeFileSync(filePathFull, fileContent);
}

exports.betterFileExists = (filePath) => {
    const filePathFull = path.join(process.cwd(), filePath);
    
    return fs.existsSync(filePathFull)
}