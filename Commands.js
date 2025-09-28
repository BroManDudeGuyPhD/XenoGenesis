// All chat commands are defined and maintained here

const formatMessage = require("./utils/messages.js");
const { getCurrentUser, getRoomUsers } = require("./utils/users.js");
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
            desc: "Display NORMAL commands",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                
                // Build the commands list dynamically from the normal commands object
                var commandList = "Available commands:\n";
                
                // Create a temporary Commands instance to access the objects
                var tempCommands = new Commands("", "", null, null, null);
                
                for (let cmd in tempCommands.normal) {
                    commandList += `/${cmd} - ${tempCommands.normal[cmd].desc}\n`;
                }
                
                socket.emit("message", formatMessage({
                    username: botName,
                    text: commandList.trim(),
                    type: "status",
                }));
            }
        }
    }


    //Object containing ADMIN commands
    admin = {
        broadcast: {
            desc: "Sends a server message to all players",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                
                if (!param || param.trim() === '') {
                    socket.emit("message", formatMessage({
                        username: botName,
                        text: "Usage: /broadcast <message>",
                        type: "status",
                    }));
                    return;
                }

                console.log(`📢 Broadcasting message from ${player.username}: "${param}"`);
                console.log(`📢 Connected sockets count: ${io.sockets.sockets.size}`);
                
                const broadcastMessage = formatMessage({
                    username: botName,
                    text: param,
                    type: "broadcast",
                    admin: false,
                    room: "Global"
                });
                
                console.log(`📢 Broadcast message object:`, broadcastMessage);
                
                io.emit("message", broadcastMessage);
                
                console.log(`📢 io.emit() called successfully`);
                
                // Confirm to admin that broadcast was sent
                socket.emit("message", formatMessage({
                    username: botName,
                    text: `✅ Broadcast sent to ${io.sockets.sockets.size} connected clients`,
                    type: "status",
                    admin: false
                }));
            }
        },

        commands: {
            desc: "Display ADMIN commands",
            execute(data) {
                var socket = data.socket, param = data.param, io = data.io, player = data.player;
                
                // Build combined commands list dynamically for admins
                var commandList = "Available commands:\n\n";
                
                // Create a temporary Commands instance to access the objects
                var tempCommands = new Commands("", "", null, null, null);
                
                // First show normal commands
                commandList += "NORMAL COMMANDS:\n";
                for (let cmd in tempCommands.normal) {
                    commandList += `/${cmd} - ${tempCommands.normal[cmd].desc}\n`;
                }
                
                // Then show admin commands
                commandList += "\nADMIN COMMANDS:\n";
                for (let cmd in tempCommands.admin) {
                    commandList += `/${cmd} - ${tempCommands.admin[cmd].desc}\n`;
                }
                
                socket.emit("message", formatMessage({
                    username: botName,
                    text: commandList.trim(),
                    type: "status",
                }));
            }
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

                                // Find and notify the target player if they're online
                                // Use the users utility to find the correct socket
                                let targetNotified = false;
                                io.sockets.sockets.forEach((clientSocket) => {
                                    const user = getCurrentUser(clientSocket.id);
                                    if (user && user.username === param) {
                                        clientSocket.emit("message", formatMessage({
                                            username: botName,
                                            text: '' + player.username + ' made you an Admin! Use it wisely... ',
                                            type: "status",
                                        }));
                                        targetNotified = true;
                                        console.log(`👑 Notified ${param} (socket: ${clientSocket.id}) that they were made admin by ${player.username}`);
                                    }
                                });
                                
                                if (!targetNotified) {
                                    console.log(`👑 Made ${param} admin, but they are not currently online`);
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

                                // Find and notify the target player if they're online
                                let targetNotified = false;
                                io.sockets.sockets.forEach((clientSocket) => {
                                    const user = getCurrentUser(clientSocket.id);
                                    if (user && user.username === param) {
                                        clientSocket.emit('message', formatMessage({
                                            username: botName,
                                            text: 'You are no longer an Admin',
                                            type: 'status'
                                        }));
                                        targetNotified = true;
                                        console.log(`👑 Notified ${param} (socket: ${clientSocket.id}) that admin privileges were removed`);
                                    }
                                });
                                
                                if (!targetNotified) {
                                    console.log(`👑 Removed admin from ${param}, but they are not currently online`);
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