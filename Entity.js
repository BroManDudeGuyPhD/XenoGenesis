var initPack = {player:[]};
var removePack = {player:[]};
const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');
var _ = require('lodash');
require('./client/Inventory');
let Commands = require('./Commands')
let Room = require('./Room')
const formatMessage = require("./utils/messages");
const {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
} = require("./utils/users");

const botName = "Server";
const mainChat = "Global";

Entity = function(param) {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
        map:'forest',
    }

    if(param){
        if(param.x)
            self.x = param.x;
        if(param.y)
            self.y = param.y;
        if(param.map)
            self.map = param.map;
        if(param.id)
            self.id = param.id;
    }

    self.update = function () {
        self.updatePosition();
    }
    self.updatePosition = function () {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    return self;

}

Entity.getFrameUpdateData = function () {
    var pack = {
        initPack: {
            player: initPack.player,
            //bullet: initPack.bullet,
        },
        removePack: {
            player: removePack.player,
            //bullet: removePack.bullet,
        },
        updatePack: {
            player: Player.update(),
            //bullet: Bullet.update(),

        }
    };

    initPack.player = [];
    //initPack.bullet = [];
    removePack.player = [];
    //removePack.bullet = [];
    return pack;
}

Player = function (param) {
    var self = Entity(param);
    self.number = "" + Math.floor(10 * Math.random());
    self.username = param.username;
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;
    self.hp = 100;
    self.hpMax = 100;
    self.score = 0;
    self.startingContinent = param.startingContinent || "";
    self.conquredContinents = "";
    self.socket = param.socket;
    self.jointime = param.jointime;
    self.room = param.room;
    self.admin = param.admin;

    var super_update = self.update;
    self.update = function(){
        self.updateSpd();

        super_update();
    }

    self.updateSpd = function () {
        if (self.pressingRight)
            self.spdX = self.maxSpd;
        else if (self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;
        if (self.pressingUp)
            self.spdY = -self.maxSpd;
        else if (self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    }

    self.getInitPack = function () {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            number:self.number,
            hp:self.hp,
            hpMax:self.hpMax,
            score:self.score,
            map:self.map,
            startingContinent:self.startingContinent,
        };
    }

    self.getUpdatePack = function () {
        return {
            id:self.id,
            x:self.x,
            y:self.y,
            hp:self.hp,
            score:self.score,
            map:self.map,
            conquredContinents:self.conquredContinents,
        };
    }

    Player.list[self.id] = self;

    initPack.player.push(self.getInitPack());

    return self;
}

Player.list = {};
roomList = [];
let newRoom = new Room("server", "Global");
roomList.push(newRoom);

var continentCoords = {
    NorthEast:{
        x:1500,
        y:100,
    },
    NorthWest:{
        x:300,
        y:100,
    },
    SouthEast:{
        x:1400,
        y:650,
    },
    SouthWest:{
        x:300,
        y:700,
    },
    Middle:{
        x:900,
        y:400,
    },
}

String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var days   = Math.floor(sec_num / 86400);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    var time = days +"d:"+ hours+'h:'+minutes+'m:'+seconds+"s";
    return time;
}

////
// Player logs in
Player.onConnect = function(socket,username,admin,io){
    //console.log(io.of("/").adapter);
    console.log(username +" joined")

    // Store player data but don't create game player object yet
    var playerData = {
        username:username,
        id:socket.id,
        socket:socket,
        io:io,
        admin:admin,
        room:mainChat,
        jointime: new Intl.DateTimeFormat('default',{
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date()),
    };

    // Don't add user to chat system immediately - wait for them to join a room

    socket.on('leaveRoom', (room) => {

        const userLeaving = userLeave(socket.id);
        if (userLeaving) {
            // Send users and room info to the room they're leaving
            io.in(room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(room),
                usersCount: Player.getLength() 
            });
            
            // Send a leave message to the room they're leaving
            io.in(room).emit("message", formatMessage({
                username: botName,
                text: `${userLeaving.username} has left the chat`,
                type: "status",
                room: room
            }));
        }
        
        // Only auto-join Global if they're leaving a specific room (not Global itself)
        if (room !== mainChat && room !== "Global") {
            const user = userJoin(socket.id, playerData.username, mainChat);
            socket.leave(room);
            socket.join(mainChat);
            playerData.room = mainChat;
            
            // Send welcome message to Global
            socket.emit("message", formatMessage({
                username: botName,
                text: `Welcome back to ${mainChat} chat!`,
                type: "update",
                admin: "admin",
                room: mainChat
            }));
            
            // Update Global room users
            io.in(mainChat).emit("roomUsers", {
                room: mainChat,
                users: getRoomUsers(mainChat),
                usersCount: Player.getLength() 
            });
        }

    });

    socket.on("joinRoom", (room) => {
        //console.log(io.sockets.adapter.rooms);

        //Search roomList array values represnted as lowercase to check if entered room name is valid regardless of case
        const roomIndex = roomList.findIndex(element => {
            return element.name.toLowerCase() === room.toLowerCase();
        });

        if ( roomIndex !== -1 ) {
            room = _.startCase(room);
            const user = userJoin(socket.id, playerData.username, room);
            socket.join(room);
            playerData.room = room;

            // Welcome current user
            socket.emit("message", formatMessage({
                username: botName,
                text: `Welcome to ${room} chat!`,
                type: "update",
                admin: "admin",
                room: room
            }));

            // Broadcast when a user connects
            // io.emit() sends to EVERYONE, this omits the user who joined
            socket.broadcast
                .to(user.room)
                .emit(
                    "message", formatMessage({
                        username: botName,
                        text: `${playerData.username} has joined the chat`,
                        type: "status",
                        admin: "admin"
                    }));

            // Send users and room info
            io.to(user.room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(user.room),
                usersCount: Player.getLength() 
            });

            // Check if there's an active game in this room and auto-join the player
            // Only auto-join if the user is joining a room that's not Global and has active players
            if (room !== "Global" && room !== mainChat) {
                const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
                console.log(`🔍 JOIN ROOM DEBUG - User: ${playerData.username}, Room: ${room}, Total Players in list: ${Object.keys(Player.list).length}, Players in this room: ${playersInRoom.length}`);
                
                if (playersInRoom.length > 0) {
                    console.log(`🎮 Auto-joining ${playerData.username} to existing game in room: ${room}`);
                    
                    // Auto-start the game for the joining player (they become a player immediately)
                    Database.getPlayerProgress(playerData.username, function(progress) {
                        Player.onGameStart(playerData.socket, playerData.username, progress, io, room, playerData.admin);
                    });
                } else {
                    console.log(`❌ No active game in room ${room} for ${playerData.username} to join`);
                }
            } else {
                console.log(`⏩ Skipping game init for ${playerData.username} joining ${room} (Global or main chat)`);
            }

            if(room !== "Global")
                socket.emit("joinRoom", room);
        }

        else{
            socket.emit("message", formatMessage({
                username: botName,
                text: "\""+ room +"\" is not a valid room",
                type: "status",
            }));
        }

    });

    socket.on('createRoom', function(){
        const shortName = uniqueNamesGenerator({
            dictionaries: [colors,animals], 
            separator: ' ',
            length: 2
        });

        let roomName = _.startCase(shortName); 
        console.log(roomName)
        //roomList.push(roomName);

        let newRoom = new Room(playerData.username, roomName);
        roomList.push(newRoom);

        console.log("ROOM LIST: ")
        console.log(roomList)

        socket.emit("roomCreated",roomName)


    });


    socket.on("chatMessage", (data) => {
        io.in(data.room).emit("message", formatMessage({
            username: playerData.username,
            text: data.msg,
            type: "normal",
            admin: playerData.admin,
            room:data.room
        }));
        
    });
    
    socket.on('privateMessage', function (data) {
        var recipientSocket = null;

        for (var i in Player.list)
            if (Player.list[i].username === data.recipient)
                recipientSocket = Player.list[i].socket;
        if (recipientSocket === null) {
            socket.emit("message", formatMessage({
                username: botName,
                text: 'The player ' + data.recipient + ' is not online',
                type: "status",
            }));

        } else {
            recipientSocket.emit("message", formatMessage({
                username: playerData.username + " (whisper)",
                text: data.message,
                type: "pm",
            }));

            socket.emit("message", formatMessage({
                username: botName,
                text: 'PM sent to: ' + data.recipient,
                type: "status",
            }));
        }
    });

    socket.on('commandMessage', function(data){
        const command = data.message.split(" ")[0];
        const param = data.message.replace(command, "").trim()
        console.log("### Username: " + playerData.username, " - Command: " + command)
        
        if (param.length > 1) 
            console.log("Param: " + param)

        let commands = new Commands(command,param,io,playerData,socket);

        //Logic to execute commands
        if (command in commands.normal) {
            commands.runNormalCommand();
        }

        else if (command in commands.admin) {
            //Check if user is admin
            Database.isAdmin({ username: playerData.username }, function (res) {
                if (res !== true) {
                    console.log("NOT Admin " + playerData.username);
                    return;
                }
                //Execute command if they are
                commands.runAdminCommand();
            });
        }

        else{
            socket.emit("message", formatMessage({
                username: botName,
                text: "'"+ command + "'" + "is not a command, run .commands to see list",
                type: "status",
            }));
        }
    });

    socket.on('evalServer', function(data){
        var res = eval(data);
        socket.emit('evalAnswer',res);
    });

    socket.on("disconnect", () => {
        const user = getCurrentUser(socket.id);
        if (user) {
            // Send leave message to the room the user was actually in
            io.to(user.room).emit(
                "message",
                formatMessage({
                    username: botName,
                    text: `${user.username} has left the chat`,
                    type: "status",
                    room: user.room
                })
            );
            
            // Remove user from the users array
            userLeave(socket.id);
    
            // Send updated room users to the room they left (not Global)
            io.to(user.room).emit("roomUsers", {
                room: user.room,
                users: getRoomUsers(user.room),
                usersCount: Player.getLength() 
            });
        }
    });


    socket.on('startGame', (data) => {
        console.log('🎮 Starting game for room:', data.room);
        
        // Get all users in the room
        const usersInRoom = getRoomUsers(data.room);
        console.log('🎮 Users in room:', usersInRoom.map(u => u.username));
        
        let playersCreated = 0;
        const totalPlayers = usersInRoom.length;
        
        // Start the game for all users in the room
        usersInRoom.forEach(user => {
            // Get the socket for this user from socket.io room members
            const userSocket = io.sockets.sockets.get(user.id);
            
            if (userSocket) {
                console.log(`🎮 Starting game for user: ${user.username} (${user.id})`);
                Database.getPlayerProgress(user.username, function(progress){
                    // Determine if user is admin (only the person who clicked start game is admin for now)
                    const isAdmin = user.id === socket.id;
                    
                    // Create the player but don't send init events yet
                    Player.onGameStart(userSocket, user.username, progress, null, data.room, isAdmin);
                    
                    playersCreated++;
                    
                    // After all players are created, send one coordinated init event to all
                    if (playersCreated === totalPlayers) {
                        console.log('🎮 All players created, sending coordinated init events');
                        
                        // Get updated room players data
                        const roomPlayers = Object.values(Player.list).filter(p => p.room === data.room);
                        const roomPlayerData = roomPlayers.map(p => p.getInitPack());
                        
                        // Send personalized init data to each player
                        roomPlayers.forEach(player => {
                            player.socket.emit('init', {
                                selfId: player.socket.id,
                                player: roomPlayerData,
                            });
                        });
                    }
                });
            } else {
                console.log(`❌ Could not find socket for user: ${user.username} (${user.id})`);
            }
        });
        
        // Notify other sockets in the room that the game started (but they're already in it)
        socket.to(data.room).emit("gameStarted");
        console.log("SOCKET:: ROOM started: " + data.room + " with " + usersInRoom.length + " players");
    });

    socket.on('beginGame', (data) => {
        // Database.getPlayerProgress(data.username,function(progress){
        //     Player.onGameStart(player.socket,player.username,progress, room);
        // });
        console.log("SOCKET::  ROOM began: "+ data.room)
    });

}

////
// Player Starts a Game
Player.onGameStart = function(socket,username, progress, io, room, admin){
    var map = 'forest';

    const continents = ["NorthWest", "NorthEast", "SouthEast", "SouthWest","Middle"];
    
    // Find continents already taken in this room
    const takenContinents = [];
    for(var i in Player.list){
        const player = Player.list[i];
        if(player.room === room && player.startingContinent) {
            takenContinents.push(player.startingContinent);
        }
    }
    
    // Find available continents
    const availableContinents = continents.filter(continent => !takenContinents.includes(continent));
    
    // Select continent (random from available, or error if room is full)
    let startingLocation;
    if(availableContinents.length > 0) {
        startingLocation = availableContinents[Math.floor(Math.random() * availableContinents.length)];
    } else {
        console.log(`❌ Room ${room} is full! No available continents for ${username}`);
        socket.emit('roomFull', { message: 'Room is full (5 players max)' });
        return; // Don't create the player
    }
    
    var x,y
    
    //Get starting x,y based on continent coordinates
    for(place in continentCoords){
        if(place === startingLocation){
            x = continentCoords[place].x;
            y = continentCoords[place].y;
            break; // Exit loop once found
        }
    }
    
    // Fallback if continent coordinates weren't found (shouldn't happen)
    if(x === undefined || y === undefined) {
        console.log(`❌ Warning: No coordinates found for continent ${startingLocation}, using default position`);
        x = 900; // Middle position as fallback
        y = 400;
    }


    var player = Player({
        username:username,
        id:socket.id,
        socket:socket,
        map:map,
        room:room,
        x:x,
        y:y,
        inventory:progress,
        startingContinent:startingLocation,
        admin:admin,
    });

    player.inventory = new Inventory(progress.items,socket,true);

    player.inventory.refreshRender();

    console.log("Game started for room: "+player.room)
    console.log(`${player.username} joined the server -- ${startingLocation} at ${x},${y}`);
    console.log(`Available continents were: [${availableContinents.join(', ')}]`);
    console.log(`Taken continents in room ${room}: [${takenContinents.join(', ')}]`);

    // Key Presses
    socket.on('keyPress', function (data) {
        if (data.inputId === 'left')
            player.pressingLeft = data.state;
        else if (data.inputId === 'right')
            player.pressingRight = data.state;
        else if (data.inputId === 'up')
            player.pressingUp = data.state;
        else if (data.inputId === 'down')
            player.pressingDown = data.state;
    });

    socket.on('changeMap',function(data){
        if(player.map === 'snow'){
            player.map = 'forest';
            //player.inventory.addItem("potion",1);
        }
            
        else{
            player.map = 'snow';
            player.inventory.addItem("potion",1);
        }
            
    });

    // Player Sockets
    
    // Get players in the current room only
    const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
    const roomPlayerData = playersInRoom.map(p => p.getInitPack());
    
    // Only send init events if io is provided (for coordinated multi-user start, io will be null)
    if (io) {
        // Send personalized init data to each player in the room
        playersInRoom.forEach(player => {
            player.socket.emit('init', {
                selfId: player.socket.id,
                player: roomPlayerData,
            });
        });
    }

    // socket.emit('init',{
    //     selfId:socket.id,
    //     player:Player.getAllInitPack(),
    // })

    // Save Intentory, if player was in a game
    socket.on('disconnect', function(){
        Database.savePlayerProgress({
            username:player.username,
            items:player.inventory.items,
        });
    });
    
}

Player.getAllInitPack = function(){
    var players = [];
    for (var i in Player.list)
        players.push(Player.list[i].getInitPack());
    return players;
}

// Runs when client disconnects
Player.onDisconnect = function(socket, io){
    let player = Player.list[socket.id];
    if(!player)
        return;
    delete Player.list[socket.id];
    removePack.player.push(socket.id);

    // Don't duplicate the user leave logic here since it's handled in the disconnect event
    // The user leave and room update is already handled in the socket disconnect event above
}

Player.update = function(){
    var pack = [];
    for(var i in Player.list){
        var player = Player.list[i];
        player.update();
        pack.push(player.getUpdatePack());
    }
    return pack;
}

Player.getLength = function(){
    return Object.keys(Player.list).length;
}
