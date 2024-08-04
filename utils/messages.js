const moment = require('moment');

function formatMessage(param) {

  if(param.room){
  return {
    username: param.username,
    text: param.text,
    time: moment().format('h:mm a'),
    type: param.type,
    admin: param.admin,
    room:param.room
  };
}

else{
  return {
    username: param.username,
    text: param.text,
    time: moment().format('h:mm a'),
    type: param.type,
    admin: param.admin,
    room:"Global"
  };
}
}

module.exports = formatMessage;
