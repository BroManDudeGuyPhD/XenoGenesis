// All chat commands are defined and maintained here

const formatMessage = require("./utils/messages.js");
require('./Database.js');
const botName = "Server"

class Commands {
    // Constructor is called in Entity.js, easily definign params for all commands at once.
    // This data is passed to the functions at the botton and then into the execute() object within the commands
    constructor(command, param, io, player, socket) {
        this.command = command;
        this.param = param;
        this.io = io;
        this.player = player;
        this.socket = socket;
    }

    //Object containing NORMAL commands
    normal = {
        uptime: {
            desc: "Returns the uptime of the server",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                var time = process.uptime();
                var uptime = (time + "").toHHMMSS();

                socket.emit("message", formatMessage({
                    username: botName,
                    text: "Uptime: " + uptime,
                    type: "status",
                }));

            }
        },
        commands: {
            desc: "Display NORMAL commands"
        }
    }


    //Object containing ADMIN commands
    admin = {
        broadcast: {
            desc: "Sends a server message to all players",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                var time = process.uptime();

                io.emit("message", formatMessage({
                    username: botName,
                    text: data.param,
                    type: "broadcast",
                }));
            }
        },

        commands: {
            desc: "Display ADMIN commands"
        },

        op: {
            desc: "Make user an admin aka op",
            ex: "op <username>",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                var time = process.uptime();
                Database.isUsernameTaken({ username: param }, function (res) {
                    if (res) {
                        Database.makeAdmin({ username: param }, function (result) {
                            if (result == true) {
                                socket.emit("message", formatMessage({
                                    username: botName,
                                    text: '' + param + ' is now OP',
                                    type: "status",
                                }));

                                var opSocket = null;
                                for (var i in Player.list)
                                    if (Player.list[i].username === param)
                                        opSocket = Player.list[i].socket;
                                if (opSocket !== null) {
                                    // If player is online, notify them that they are now an Admin
                                    opSocket.emit("message", formatMessage({
                                        username: botName,
                                        text: '' + player.username + '' + ' made you an Admin! Use it wisely... ',
                                        type: "status",
                                    }));
                                }
                            }
                            else {
                                socket.emit("message", formatMessage({
                                    username: botName,
                                    text: 'Error! Was not able to make ' + param + ' OP',
                                    type: "status",
                                }));
                            }
                        });
                    }
                    else {
                        socket.emit("message", formatMessage({
                            username: botName,
                            text: '' + param + ' is not a valid player name',
                            type: "status",
                        }));
                    }
                });
            }
        },

        deop: {
            desc: "Removes admin rights from user",
            ex: "deop <username>",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                var time = process.uptime();

                Database.isUsernameTaken({ username: param }, function (res) {
                    if (res) {
                        Database.removeAdmin({ username: param }, function (result) {
                            if (result == false) {
                                socket.emit("message", formatMessage({
                                    username: botName,
                                    text: '' + param + ' is no longer OP',
                                    type: "status",
                                }));

                                var opSocket = null;
                                for (var i in Player.list)
                                    if (Player.list[i].username === param)
                                        opSocket = Player.list[i].socket;
                                if (opSocket !== null) {
                                    // If player is online, notify them that they are now an Admin
                                    opSocket.emit('message', formatMessage({
                                        username: botName,
                                        text: 'You are no longer an Admin',
                                        type: 'status'
                                    }));
                                }
                            }
                            else {
                                socket.emit("message", formatMessage({
                                    username: botName,
                                    text: 'Error! Was not able to remove ' + param + ' OP status',
                                    type: "status",
                                }));
                            }
                        });
                    }
                    else {
                        socket.emit("message", formatMessage({
                            username: botName,
                            text: '' + param + ' is not a valid player name',
                            type: "status",
                        }));
                    }
                });
            }
        }
    } //End of AdminCommands

    runNormalCommand() {
        this.normal[this.command].execute({ socket: this.socket, param: this.param, io: this.io ,player: this.player})

    }

    runAdminCommand() {
        this.admin[this.command].execute({ socket: this.socket, param: this.param, io: this.io, player: this.player })
    }
}

module.exports = Commands;