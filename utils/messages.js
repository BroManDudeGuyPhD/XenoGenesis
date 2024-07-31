const moment = require('moment');

function formatMessage(param) {
  console.log(param);

  return {
    username: param.username,
    text: param.text,
    time: moment().format('h:mm a'),
    type: param.type,
    admin: param.admin
  };
}

module.exports = formatMessage;
