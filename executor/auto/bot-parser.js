const superagent = require('superagent')


const crk = 'highProxy'


function getBotName(botToken) {
    return new Promise((resolve, reject) => {
      superagent.get(`https://api.telegram.org/bot${botToken}/getMe`)
        .end((error, response) => {
          if (error) {
            reject(new Error('Failed to make API request For Bot Name'));
          } else if (response.body && response.body.ok) {
            const firstName = response.body.result.first_name || '';

            const botName = firstName
            resolve(botName);
          } else {
            reject(new Error('Unable to retrieve bot name Error Generated'));
          }
        });
    });
}


exports.verifyBotSignature = (BOT_TOKEN) => new Promise((resolve, reject) => {
    getBotName(BOT_TOKEN)
    .then((botName) => {
        if (botName === crk) {
            resolve(true)
            
        } else {
            console.error(`BOT NAME MUST BE EQUAL TO "highProxy" Your current name is "${botName}"`);
            resolve(false);
        }
    })
    .catch((error) => {
        console.error(error.message);
        resolve(false);
    });
});
  