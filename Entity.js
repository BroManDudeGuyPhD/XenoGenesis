var initPack = {player:[]};
var removePack = {player:[]};
const { uniqueNamesGenerator, colors, animals } = require('unique-names-generator');
var _ = require('lodash');
require('./client/Inventory');
let Commands = require('./Commands')
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
    self.startingContinent = "";
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
roomList = [mainChat];

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
    var player = Player({
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
    });

    socket.on('leaveRoom', (room) => {

        const userLeaving = userLeave(socket.id);
        if (userLeaving) {
            // Send users and room info
            io.in(room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(room),
            });
        }
        if (room !== mainChat) {
            const user = userJoin(socket.id, player.username, mainChat);
            socket.join(mainChat);
            io.in(mainChat).emit("roomUsers", {
                room: mainChat,
                users: getRoomUsers(mainChat),
            });

            socket.emit("leaveRoom");
        }

    });

    socket.on("joinRoom", (room) => {
        //console.log(io.sockets.adapter.rooms);

        //Search roomList array values represnted as lowercase to check if entered room name is valid regardless of case
        const roomIndex = roomList.findIndex(element => {
            return element.toLowerCase() === room.toLowerCase();
        });

        if ( roomIndex !== -1 ) {
            room = _.startCase(room);
            const user = userJoin(socket.id, player.username, room);
            socket.join(room);
            player.room = room;

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
                        text: `${player.username} has joined the chat`,
                        type: "status",
                        admin: "admin"
                    }));

            // Send users and room info
            io.in(user.room).emit("roomUsers", {
                room: room,
                users: getRoomUsers(user.room),
            });

            if(room !== "Global")
                socket.emit("joinRoom");
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
        roomList.push(roomName);

        socket.emit("roomCreated",roomName)
    });


    socket.on("chatMessage", (data) => {
        io.in(data.room).emit("message", formatMessage({
            username: player.username,
            text: data.msg,
            type: "normal",
            admin: player.admin,
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
                username: player.username + " (whisper)",
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
        console.log("### Username: " + player.username, " - Command: " + command)
        
        if (param.length > 1) 
            console.log("Param: " + param)

        let commands = new Commands(command,param,io,player,socket);

        //Logic to execute commands
        if (command in commands.normal) {
            commands.runNormalCommand();
        }

        else if (command in commands.admin) {
            //Check if user is admin
            Database.isAdmin({ username: player.username }, function (res) {
                if (res !== true) {
                    console.log("NOT Admin " + player.username);
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
        const user = userLeave(socket.id);
    
        if (user) {
            io.to(user.room).emit(
                "message",
                formatMessage(botName, `${user.username} has left the chat`)
            );
    
            // Send users and room info
            io.in(user.room).emit("roomUsers", {
                room: user.room,
                users: getRoomUsers(user.room),
            });
        }
    });

}

////
// Player Starts a Game
Player.onGameStart = function(socket,username,progress){
    player.inventory = new Inventory(progress.items,socket,true);
    var map = 'forest';

    const continents = ["NorthWest", "NorthEast", "SouthEast", "SouthWest","Middle"];
    const startingLocation = continents[Math.floor(Math.random() * continents.length)];
    var x,y
    
    //Get Random stary x,y based on continent coordinates
    for(place in continentCoords){
        if(place === startingLocation){
            x = continentCoords[place].x;
            y = continentCoords[place].y;
        }
    }

    var player = Player({
        username:username,
        id:socket.id,
        socket:socket,
        map:map,
        x:x,
        y:y,
        startingContinent:startingLocation,
    });

    player.inventory.refreshRender();

    
    console.log(player.username+" joined the server -- "+startingLocation +" "+x+","+y);

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
    
    socket.emit('init',{
        selfId:socket.id,
        player:Player.getAllInitPack(),
    })

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

    const user = userLeave(socket.id);
        if (user) {
            io.to(user.room).emit(
                "message", formatMessage({
                    username: botName,
                    text: `${user.username} has left the chat`,
                    type: "status",
            }));

            // Send users and room info
            io.in(user.room).emit("roomUsers", {
                room: user.room,
                users: getRoomUsers(user.room),
            });
        }
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
