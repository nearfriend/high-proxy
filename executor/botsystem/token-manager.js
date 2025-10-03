const crypto = require('crypto');

class TokenManager {
  constructor() {
    this.kObject = {};
  }

  createToken(clientContext) {
    const token = crypto.randomBytes(64).toString('hex'); 
    const value = {};
    this.kObject[token] = {
      context: clientContext,
      expiration: Date.now() + 7 * 60 * 1000, // Set the expiration time to 5 minutes from now
    };

    // After 5 minutes, check if the token has been consumed. If not, delete it.
    setTimeout(() => {
      if (this.kObject[token] && this.kObject[token].expiration <= Date.now()) {
        delete this.kObject[token];
      }
    }, 10 * 60 * 1000);
    return token;
  }

  verifyToken(token) {
    if (!this.kObject[token]) {
      return null;
    // eslint-disable-next-line no-else-return
    } else if (this.kObject[token].expiration <= Date.now()) {
      delete this.kObject[token];
      return null
    }
    const { context } = this.kObject[token];
    // delete this.kObject[token];
    return context;
  }
}

module.exports = TokenManager;
