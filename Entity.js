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

// Behavioral Economics Experiment State
var GameSessions = {}; // Key: room name, Value: session data

// Token pool - shared across all sessions  
var GlobalTokenPool = {
    whiteTokens: 2500, // Starts with 2,500 white tokens
    blackTokens: Infinity // Unlimited black tokens
};

// Experimental conditions
var Conditions = {
    BASELINE: {
        name: "Baseline",
        whiteTokenValue: 0.01,
        blackTokenValue: 0.05
    },
    HIGH_CULTURANT: {
        name: "High Culturant", 
        whiteTokenValue: 0.02,
        blackTokenValue: 0.07
    },
    HIGH_OPERANT: {
        name: "High Operant",
        whiteTokenValue: 0.03,
        blackTokenValue: 0.04
    },
    EQUAL_CULTURANT_OPERANT: {
        name: "Equal Culturant-Operant",
        whiteTokenValue: 0.01,
        blackTokenValue: 0.02
    }
};

// AI Player Configuration
var AIConfig = {
    enabled: true,
    maxAIPlayers: 2, // Up to 2 AI players per triad
    decisionDelay: 2000, // AI decision delay in milliseconds (2 seconds)
    behaviorTypes: {
        RANDOM: { name: "Random", impulsiveChance: 0.5 },
        IMPULSIVE: { name: "Impulsive", impulsiveChance: 0.8 },
        CONSERVATIVE: { name: "Conservative", impulsiveChance: 0.2 },
        ADAPTIVE: { name: "Adaptive", impulsiveChance: 0.5 } // Could be made smarter later
    }
};

// AI Player Management
var AIPlayer = {
    create: function(room, playerNumber, behaviorType = 'RANDOM') {
        const aiId = `AI_${room}_P${playerNumber}_${Date.now()}`;
        const behavior = AIConfig.behaviorTypes[behaviorType] || AIConfig.behaviorTypes.RANDOM;
        
        // Create AI player with null socket (special case)
        const aiPlayer = Player({
            username: `AI Player ${playerNumber} (${behavior.name})`,
            id: aiId,
            socket: null, // AI players don't have real sockets
            room: room,
            x: 0,
            y: 0,
            inventory: { items: [] },
            startingContinent: "",
            admin: false,
        });
        
        // Add AI-specific properties
        aiPlayer.isAI = true;
        aiPlayer.behaviorType = behaviorType;
        aiPlayer.impulsiveChance = behavior.impulsiveChance;
        
        console.log(`🤖 Created AI player: ${aiPlayer.username} in room ${room}`);
        return aiPlayer;
    },
    
    makeDecision: function(aiPlayer) {
        if (!aiPlayer.isAI) return;
        
        // Simple random decision based on behavior type
        const choice = Math.random() < aiPlayer.impulsiveChance ? 'impulsive' : 'self-control';
        aiPlayer.currentChoice = choice;
        aiPlayer.isLockedIn = true; // AI players automatically lock in their decisions
        
        console.log(`🤖 ${aiPlayer.username} chose and locked in: ${choice}`);
        return choice;
    },
    
    // Simulate AI making decisions for all AI players in a room
    processAIDecisions: function(room, gameSession) {
        const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
        const aiPlayers = roomPlayers.filter(p => p.isAI && (!p.currentChoice || !p.isLockedIn));
        
        aiPlayers.forEach(aiPlayer => {
            setTimeout(() => {
                AIPlayer.makeDecision(aiPlayer);
                
                // Check if all voting players (exclude moderator) have locked in after this AI decision
                const allPlayers = Object.values(Player.list).filter(p => p.room === room);
                const currentRoom = roomList.find(r => r.name === room);
                const votingPlayers = allPlayers.filter(p => {
                    return !(currentRoom && p.username === currentRoom.creator); // Exclude moderator
                });
                const allLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
                
                console.log(`🤖 AI ${aiPlayer.username} finished decision. Lock-in status: ${votingPlayers.filter(p => p.isLockedIn).length}/${votingPlayers.length}`);
                
                if (allLockedIn) {
                    console.log(`🎯 All voting players locked in after AI decision! Processing round...`);
                    setTimeout(() => {
                        processRound(room, gameSession);
                    }, 500);
                }
            }, Math.random() * AIConfig.decisionDelay); // Random delay up to 2 seconds
        });
    }
};

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
    
    // Remove old game properties - keeping for compatibility but will be unused
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;
    self.hp = 100;
    self.hpMax = 100;
    
    // New behavioral economics properties
    self.whiteTokens = 0;           // Individual reinforcement tokens
    self.blackTokens = 0;           // Group reinforcement tokens  
    self.totalEarnings = 0;         // Money earned so far
    self.currentChoice = null;      // 'impulsive' or 'self-control' 
    self.roundsPlayed = 0;
    self.culturantsProduced = 0;    // Times all 3 chose self-control
    self.triadPosition = 0;         // 1, 2, or 3 for turn order
    self.isActivePlayer = false;    // Whose turn it is in current round
    self.seatPosition = 'center';   // 'left', 'top', 'right' for poker table positioning
    
    // AI properties
    self.isAI = param.isAI || false;
    self.behaviorType = param.behaviorType || null;
    self.impulsiveChance = param.impulsiveChance || 0.5;
    
    // Legacy properties (keeping for now)
    self.score = 0;
    self.startingContinent = param.startingContinent || "";
    self.conquredContinents = "";
    self.socket = param.socket;
    self.jointime = param.jointime;
    self.room = param.room;
    self.admin = param.admin;

    var super_update = self.update;
    self.update = function(){
        // Remove movement logic for behavioral experiment
        // self.updateSpd();
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
            username:self.username,
            isAI:self.isAI,
            whiteTokens:self.whiteTokens,
            blackTokens:self.blackTokens,
            totalEarnings:self.totalEarnings,
            triadPosition:self.triadPosition,
            seatPosition:self.seatPosition
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

// Game Session Management Functions
GameSession = {
    create: function(roomName) {
        if (GameSessions[roomName]) {
            return GameSessions[roomName];
        }
        
        GameSessions[roomName] = {
            roomName: roomName,
            currentRound: 0,
            maxRounds: 500,
            currentCondition: Conditions.BASELINE,
            activePlayerIndex: 0, // Which player's turn (0, 1, 2)
            roundChoices: [], // Store choices for current round
            gameState: 'lobby', // 'lobby', 'playing', 'finished'
            culturantsProduced: 0,
            sessionStartTime: new Date(),
            dataLog: [], // For CSV export
            grid: GameSession.generateRandomGrid() // Random + and - placement
        };
        
        console.log(`🎮 Created new GameSession for room: ${roomName}`);
        return GameSessions[roomName];
    },
    
    generateRandomGrid: function() {
        // Create 2x3 grid with random + and - placement
        const positions = [
            {row: 'odd', col: 1}, {row: 'odd', col: 2}, {row: 'odd', col: 3},
            {row: 'even', col: 1}, {row: 'even', col: 2}, {row: 'even', col: 3}
        ];
        
        // Randomly assign + and - to positions
        return positions.map(pos => ({
            ...pos,
            symbol: Math.random() < 0.5 ? '+' : '-'
        }));
    },
    
    get: function(roomName) {
        return GameSessions[roomName];
    },
    
    assignTriadPositions: function(roomName) {
        const session = GameSessions[roomName];
        if (!session) return;
        
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        
        // Poker table positioning: positions for 3 players + moderator
        const pokerPositions = [
            { x: 100, y: 200, seat: 'left', description: 'Left player' },     // Position 1: Left side
            { x: 250, y: 100, seat: 'top', description: 'Top player' },       // Position 2: Top center
            { x: 400, y: 200, seat: 'right', description: 'Right player' },   // Position 3: Right side
            // Moderator position at bottom center (x: 250, y: 350) - not assigned to players
        ];
        
        playersInRoom.forEach((player, index) => {
            player.triadPosition = index + 1; // 1, 2, 3
            
            // Assign poker table positions
            if (index < 3) { // Only assign to first 3 players
                const position = pokerPositions[index];
                player.x = position.x;
                player.y = position.y;
                player.seatPosition = position.seat;
                
                console.log(`🎯 Assigned ${player.username} to ${position.description} (${position.x}, ${position.y})`);
            }
        });
        
        console.log(`🃏 Poker table setup complete for ${roomName}: ${playersInRoom.length} players positioned`);
        console.log(`   Moderator space available at bottom center (250, 350)`);
    },
    
    // Add AI players to fill empty spots for testing
    fillWithAI: function(roomName, targetPlayerCount = 3) {
        if (!AIConfig.enabled) return;
        
        const playersInRoom = Object.values(Player.list).filter(p => p.room === roomName);
        const humanPlayers = playersInRoom.filter(p => !p.isAI);
        const currentCount = playersInRoom.length;
        const aiNeeded = Math.min(targetPlayerCount - currentCount, AIConfig.maxAIPlayers);
        
        if (aiNeeded <= 0) return;
        
        console.log(`🤖 Adding ${aiNeeded} AI players to room ${roomName} (current: ${currentCount}/${targetPlayerCount})`);
        
        const behaviorTypes = Object.keys(AIConfig.behaviorTypes);
        for (let i = 0; i < aiNeeded; i++) {
            const behaviorType = behaviorTypes[Math.floor(Math.random() * behaviorTypes.length)];
            const aiPlayer = AIPlayer.create(roomName, currentCount + i + 1, behaviorType);
            
            // No need to add to Player.list here - AIPlayer.create handles it via Player constructor
        }
        
        return aiNeeded;
    }
};

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
        console.log(`🚪 ${playerData.username} leaving room: ${room}`);
        
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
        
        // Remove player from game if they're in one
        if (room !== mainChat && room !== "Global") {
            // Find and remove the player from Player.list
            const leavingPlayer = Object.values(Player.list).find(p => p.socket.id === socket.id && p.room === room);
            if (leavingPlayer) {
                console.log(`🎮 Removing ${leavingPlayer.username} from game in room: ${room}`);
                delete Player.list[leavingPlayer.id];
                
                // Update game session - reassign positions for remaining players
                const gameSession = GameSession.get(room);
                if (gameSession) {
                    const remainingPlayers = Object.values(Player.list).filter(p => p.room === room);
                    console.log(`👥 ${remainingPlayers.length} players remaining in ${room}`);
                    
                    // Reassign poker positions for remaining players
                    GameSession.assignTriadPositions(room);
                    
                    // Send updated player list to remaining players
                    const allRoomUsers = getRoomUsers(room);
                    const playersWithModerator = allRoomUsers.map(user => {
                        const currentRoom = roomList.find(r => r.name === room);
                        return {
                            username: user.username,
                            id: user.id,
                            isAI: false,
                            isModerator: currentRoom && user.username === currentRoom.creator
                        };
                    });
                    
                    // Add any AI players that might still be in the room
                    const aiPlayersInRoom = remainingPlayers.filter(p => p.isAI);
                    aiPlayersInRoom.forEach(aiPlayer => {
                        playersWithModerator.push({
                            username: aiPlayer.username,
                            id: aiPlayer.id,
                            isAI: true,
                            isModerator: false
                        });
                    });
                    
                    console.log(`📡 Emitting updated playersInRoom for ${room} after player left:`, playersWithModerator);
                    io.to(room).emit('playersInRoom', {
                        room: room,
                        players: playersWithModerator
                    });
                }
            }
            
            // Tell the leaving player to clear their interface
            socket.emit('leftRoom', {
                room: room,
                message: `You have left ${room}`
            });
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

            // Send detailed player info for poker table updates
            const currentRoom = roomList.find(r => r.name === room);
            const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
            const allRoomUsers = getRoomUsers(room);
            
            // Create player list with moderator info
            const playersWithModerator = allRoomUsers.map(user => ({
                username: user.username,
                id: user.id,
                isAI: false, // Users from getRoomUsers are human players
                isModerator: currentRoom && user.username === currentRoom.creator
            }));
            
            // Add any AI players that might be in the room
            const aiPlayersInRoom = playersInRoom.filter(p => p.isAI);
            aiPlayersInRoom.forEach(aiPlayer => {
                playersWithModerator.push({
                    username: aiPlayer.username,
                    id: aiPlayer.id,
                    isAI: true,
                    isModerator: false
                });
            });
            
            console.log(`📡 Emitting playersInRoom for ${room}:`, playersWithModerator);
            io.to(room).emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
            
            // Also emit specifically to the joining player to ensure they get current state
            socket.emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
            
            console.log(`📡 Also sent playersInRoom directly to ${playerData.username}`);

            // Send another playersInRoom event with a slight delay to ensure client is ready
            setTimeout(() => {
                console.log(`⏰ Delayed playersInRoom emission for ${playerData.username} in ${room}`);
                socket.emit('playersInRoom', {
                    room: room,
                    players: playersWithModerator
                });
            }, 200);

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

        socket.emit("roomCreated",roomName);

        // Emit initial playersInRoom with the creator as moderator
        socket.emit('playersInRoom', {
            room: roomName,
            players: [{
                username: playerData.username,
                id: socket.id,
                isAI: false,
                isModerator: true
            }]
        });

        // Copy room name to clipboard (will be handled on client side)
        socket.emit('copyToClipboard', { text: roomName });


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
            console.log(`🔌 ${user.username} disconnected from room: ${user.room}`);
            
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
            
            // Remove player from game if they're in one
            const leavingPlayer = Object.values(Player.list).find(p => p.socket.id === socket.id && p.room === user.room);
            if (leavingPlayer) {
                console.log(`🎮 Removing disconnected ${leavingPlayer.username} from game in room: ${user.room}`);
                delete Player.list[leavingPlayer.id];
                
                // Update game session - reassign positions for remaining players
                const gameSession = GameSession.get(user.room);
                if (gameSession && user.room !== 'Global') {
                    const remainingPlayers = Object.values(Player.list).filter(p => p.room === user.room);
                    console.log(`👥 ${remainingPlayers.length} players remaining in ${user.room} after disconnect`);
                    
                    // Reassign poker positions for remaining players
                    GameSession.assignTriadPositions(user.room);
                    
                    // Send updated player list to remaining players
                    const allRoomUsers = getRoomUsers(user.room);
                    const playersWithModerator = allRoomUsers.map(roomUser => {
                        const currentRoom = roomList.find(r => r.name === user.room);
                        return {
                            username: roomUser.username,
                            id: roomUser.id,
                            isAI: false,
                            isModerator: currentRoom && roomUser.username === currentRoom.creator
                        };
                    });
                    
                    // Add any AI players that might still be in the room
                    const aiPlayersInRoom = remainingPlayers.filter(p => p.isAI);
                    aiPlayersInRoom.forEach(aiPlayer => {
                        playersWithModerator.push({
                            username: aiPlayer.username,
                            id: aiPlayer.id,
                            isAI: true,
                            isModerator: false
                        });
                    });
                    
                    console.log(`📡 Emitting updated playersInRoom for ${user.room} after disconnect:`, playersWithModerator);
                    io.to(user.room).emit('playersInRoom', {
                        room: user.room,
                        players: playersWithModerator
                    });
                }
            }
            
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
        
        try {
            // Get all users in the room (chat users, not game players yet)
            const usersInRoom = getRoomUsers(data.room);
            console.log('🎮 Users in room:', usersInRoom.map(u => u.username));
            
            if (!usersInRoom || usersInRoom.length === 0) {
                console.log('❌ No users found in room:', data.room);
                socket.emit('error', { message: 'No users found in room' });
                return;
            }
            
            // Check if players already exist in this room (from previous game start or AI addition)
            const existingPlayers = Object.values(Player.list).filter(p => p.room === data.room);
            console.log('🎮 Existing players in room:', existingPlayers.map(p => `${p.username} (${p.isAI ? 'AI' : 'Human'})`));
            
            // Only create players for users who don't already have a Player object
            const usersNeedingPlayers = usersInRoom.filter(user => 
                !existingPlayers.find(p => p.id === user.id)
            );
            
            console.log('🎮 Users needing Player objects:', usersNeedingPlayers.map(u => u.username));
            
            if (usersNeedingPlayers.length === 0) {
                console.log('🎮 All users already have Player objects, starting game...');
                // All users already have players, just start the game
                startGameForExistingPlayers(data.room, socket);
                return;
            }
            
            let playersCreated = 0;
            const totalPlayersToCreate = usersNeedingPlayers.length;
            
            // Start the game for users who need Player objects
            usersNeedingPlayers.forEach(user => {
                try {
                    // Get the socket for this user from socket.io room members
                    const userSocket = io.sockets.sockets.get(user.id);
                    
                    if (userSocket) {
                        console.log(`🎮 Creating Player object for user: ${user.username} (${user.id})`);
                        Database.getPlayerProgress(user.username, function(progress){
                            try {
                                // Determine if user is admin (only the person who clicked start game is admin for now)
                                const isAdmin = user.id === socket.id;
                                
                                // Create the player but don't send init events yet
                                Player.onGameStart(userSocket, user.username, progress, null, data.room, isAdmin);
                                
                                playersCreated++;
                                
                                // After all players are created, start the game
                                if (playersCreated === totalPlayersToCreate) {
                                    console.log('🎮 All new players created, starting game...');
                                    startGameForExistingPlayers(data.room, socket);
                                }
                            } catch (error) {
                                console.error('❌ Error in Database.getPlayerProgress callback:', error);
                                socket.emit('error', { message: 'Error starting game for player: ' + user.username });
                            }
                        });
                    } else {
                        console.log(`❌ Could not find socket for user: ${user.username} (${user.id})`);
                        // Still count as "processed" so we don't wait forever
                        playersCreated++;
                        if (playersCreated === totalPlayersToCreate) {
                            startGameForExistingPlayers(data.room, socket);
                        }
                    }
                } catch (userError) {
                    console.error('❌ Error processing user in startGame:', userError, 'User:', user);
                    playersCreated++;
                    if (playersCreated === totalPlayersToCreate) {
                        startGameForExistingPlayers(data.room, socket);
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Critical error in startGame handler:', error);
            socket.emit('error', { message: 'Critical error starting game' });
        }
    });
    
    // Helper function to start game for existing players
    function startGameForExistingPlayers(room, initiatingSocket) {
        try {
            console.log('🎮 Starting game for existing players in room:', room);
            
            // Get all players in the room (both human and AI)
            const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const humanPlayers = roomPlayers.filter(p => !p.isAI);
            
            console.log(`🎮 Room ${room} has ${roomPlayers.length} total players (${humanPlayers.length} human, ${roomPlayers.length - humanPlayers.length} AI)`);
            
            // Get or create game session
            const gameSession = GameSession.get(room) || GameSession.create(room);
            gameSession.gameState = 'playing'; // Set to playing state
            
            // Send init data to all human players (AI players don't need init events)
            const roomPlayerData = roomPlayers.map(p => p.getInitPack());
            humanPlayers.forEach(player => {
                if (player.socket && typeof player.socket.emit === 'function') {
                    player.socket.emit('init', {
                        selfId: player.socket.id,
                        player: roomPlayerData,
                    });
                    
                    // Send game start notification
                    player.socket.emit('triadComplete', {
                        message: 'Game started! Get ready to make choices.',
                        playerPosition: player.triadPosition,
                        gameSession: {
                            currentRound: gameSession.currentRound,
                            maxRounds: gameSession.maxRounds,
                            condition: gameSession.currentCondition.name,
                            grid: gameSession.grid,
                            totalPlayers: roomPlayers.length,
                            gameState: 'playing'
                        }
                    });
                } else {
                    console.warn(`⚠️ Player ${player.username} has invalid socket`);
                }
            });
            
            // Notify all sockets in the room that the game started
            io.to(room).emit("gameStarted");
            console.log(`🎮 Game started successfully in ${room} with ${roomPlayers.length} players`);
            
            // Start the behavioral experiment rounds
            if (gameSession) {
                gameSession.gameState = 'playing';
                gameSession.currentRound = 1;
                gameSession.activePlayerIndex = 0;
                
                console.log(`🧪 Starting behavioral experiment Round ${gameSession.currentRound} in ${room}`);
                
                // Clear any previous choices
                roomPlayers.forEach(p => p.currentChoice = null);
                
                // Emit yourTurn event to start gameplay
                roomPlayers.forEach((player, index) => {
                    if (player.socket && typeof player.socket.emit === 'function') {
                        const currentRoom = roomList.find(r => r.name === room);
                        const isModerator = currentRoom && player.username === currentRoom.creator;
                        
                        // In behavioral experiments, all non-moderator players can vote simultaneously
                        const canVote = !isModerator && !player.isAI; // Human participants can vote
                        
                        player.socket.emit('yourTurn', {
                            isYourTurn: canVote, // All participants can vote, not turn-based
                            isModerator: isModerator,
                            activePlayer: canVote ? player.username : 'Waiting for participants',
                            round: gameSession.currentRound,
                            condition: gameSession.currentCondition.name,
                            grid: gameSession.grid,
                            playerPosition: player.triadPosition,
                            totalPlayers: roomPlayers.length
                        });
                        console.log(`🎯 Sent yourTurn to ${player.username} (canVote: ${canVote}, moderator: ${isModerator})`);
                    }
                });
                
                // Trigger AI decisions immediately since all players vote simultaneously
                const aiPlayersInRoom = roomPlayers.filter(p => p.isAI);
                if (aiPlayersInRoom.length > 0) {
                    console.log(`🤖 Found ${aiPlayersInRoom.length} AI players, triggering their decisions...`);
                    setTimeout(() => {
                        AIPlayer.processAIDecisions(room, gameSession);
                    }, AIPlayer.decisionDelay);
                }
            }
            
            // Update poker table positions
            updateRoomPlayersDisplay(room);
            
        } catch (error) {
            console.error('❌ Error in startGameForExistingPlayers:', error);
            initiatingSocket.emit('error', { message: 'Error starting game' });
        }
    }
    
    // Helper function to update room players display
    function updateRoomPlayersDisplay(room) {
        try {
            const currentRoom = roomList.find(r => r.name === room);
            const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
            const allRoomUsers = getRoomUsers(room);
            
            // Create player list with moderator info
            const playersWithModerator = allRoomUsers.map(user => ({
                username: user.username,
                id: user.id,
                isAI: false, // Users from getRoomUsers are human players
                isModerator: currentRoom && user.username === currentRoom.creator
            }));
            
            // Add any AI players that might be in the room
            const aiPlayersInRoom = playersInRoom.filter(p => p.isAI);
            aiPlayersInRoom.forEach(aiPlayer => {
                playersWithModerator.push({
                    username: aiPlayer.username,
                    id: aiPlayer.id,
                    isAI: true,
                    isModerator: false
                });
            });
            
            console.log(`🎮 Emitting playersInRoom for ${room}:`, playersWithModerator);
            io.to(room).emit('playersInRoom', {
                room: room,
                players: playersWithModerator
            });
        } catch (error) {
            console.error('❌ Error updating room players display:', error);
        }
    }

    socket.on('addAIPlayers', (data) => {
        const username = socket.username;
        const room = data.room || "Global";
        
        console.log(`🤖 ${username || 'Unknown user'} requested to add AI players to room: ${room}`);
        
        // Check if the player has permission to add AI
        if (room === "Global") {
            socket.emit('systemMessage', { message: 'Cannot add AI players to Global chat' });
            return;
        }
        
        // Get current room information using the correct Player.list structure
        const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
        const humanPlayers = roomPlayers.filter(player => !player.isAI);
        const aiPlayers = roomPlayers.filter(player => player.isAI);
        
        // Calculate how many AI players we can add
        const maxPlayers = 3; // Triad formation
        const spotsLeft = maxPlayers - roomPlayers.length;
        const maxAI = Math.min(spotsLeft, AIConfig.maxAIPlayers - aiPlayers.length);
        
        if (maxAI <= 0) {
            socket.emit('systemMessage', { message: 'Cannot add more AI players - room is full or AI limit reached' });
            return;
        }
        
        // Add AI players
        for (let i = 0; i < maxAI; i++) {
            const playerNumber = roomPlayers.length + i + 1;
            const behaviorType = i === 0 ? 'COOPERATIVE' : 'RANDOM'; // Mix behaviors
            const aiPlayer = AIPlayer.create(room, playerNumber, behaviorType);
            
            // Add to Player.list using the existing structure
            Player.list[aiPlayer.id] = aiPlayer;
            
            console.log(`✅ Added ${aiPlayer.username} to room ${room}`);
        }
        
        // Reassign positions after adding AI players
        GameSession.assignTriadPositions(room);
        console.log(`🃏 Reassigned positions after adding AI players to ${room}`);
        
        // Notify all players in the room about the new AI players
        // Use the same data format as other playersInRoom events
        const allRoomUsers = getRoomUsers(room);
        const currentRoom = roomList.find(r => r.name === room);
        
        // Create player list with moderator info (human players)
        const playersWithModerator = allRoomUsers.map(user => ({
            username: user.username,
            id: user.id,
            isAI: false,
            isModerator: currentRoom && user.username === currentRoom.creator
        }));
        
        // Add AI players to the list
        const updatedRoomPlayers = Object.values(Player.list).filter(p => p.room === room);
        const aiPlayersInRoom = updatedRoomPlayers.filter(p => p.isAI);
        aiPlayersInRoom.forEach(aiPlayer => {
            playersWithModerator.push({
                username: aiPlayer.username,
                id: aiPlayer.id,
                isAI: true,
                isModerator: false
            });
        });
        
        console.log(`📡 Emitting playersInRoom after AI addition for ${room}:`, playersWithModerator);
        io.to(room).emit('playersInRoom', { 
            room: room, 
            players: playersWithModerator
        });
        
        // Send success message
        socket.emit('systemMessage', { 
            message: `Successfully added ${maxAI} AI player(s) to room ${room}` 
        });
        
        console.log(`🤖 Successfully added ${maxAI} AI players to room ${room}`);
    });

    socket.on('requestRoomState', (data) => {
        const room = data.room;
        const username = socket.username || 'Unknown';
        
        console.log(`🔍 ${username} requesting room state for: ${room}`);
        
        if (room === 'Global') {
            return; // Don't send room state for Global chat
        }
        
        // Get current room info
        const currentRoom = roomList.find(r => r.name === room);
        const playersInRoom = Object.values(Player.list).filter(p => p.room === room);
        const allRoomUsers = getRoomUsers(room);
        
        // Create player list with moderator info
        const playersWithModerator = allRoomUsers.map(user => ({
            username: user.username,
            id: user.id,
            isAI: false,
            isModerator: currentRoom && user.username === currentRoom.creator
        }));
        
        // Add any AI players that might be in the room
        const aiPlayersInRoom = playersInRoom.filter(p => p.isAI);
        aiPlayersInRoom.forEach(aiPlayer => {
            playersWithModerator.push({
                username: aiPlayer.username,
                id: aiPlayer.id,
                isAI: true,
                isModerator: false
            });
        });
        
        console.log(`📡 Sending room state to ${username} for ${room}:`, playersWithModerator);
        socket.emit('playersInRoom', {
            room: room,
            players: playersWithModerator
        });
        
        // Also send game session info if there's an active game
        const gameSession = GameSession.get(room);
        if (gameSession) {
            console.log(`🎮 Sending game session info to ${username}`);
            socket.emit('triadComplete', {
                room: room,
                gameSession: gameSession
            });
        }
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
    try {
        console.log(`🎯 Player.onGameStart called for ${username} in room ${room}`);
        
        // Check if this player already exists in this room
        const existingPlayer = Object.values(Player.list).find(p => p.room === room && p.username === username);
        if (existingPlayer) {
            console.log(`⚠️ Player ${username} already exists in room ${room}, skipping creation`);
            return existingPlayer; // Return existing player instead of creating new one
        }
        
        // Allow flexible player count - count current players in room more intelligently
        const currentPlayersInRoom = Object.values(Player.list).filter(p => p.room === room);
        const humanPlayersInRoom = currentPlayersInRoom.filter(p => !p.isAI);
        const aiPlayersInRoom = currentPlayersInRoom.filter(p => p.isAI);
        
        console.log(`🔍 Room ${room} capacity check: ${currentPlayersInRoom.length} total (${humanPlayersInRoom.length} human + ${aiPlayersInRoom.length} AI)`);
        
        // More flexible capacity: Allow multiple human players + AI up to reasonable limit
        // For behavioral experiments: typically 1 moderator + 2-3 participants = 3-4 total
        if(currentPlayersInRoom.length >= 4) {
            console.log(`❌ Room ${room} is at maximum capacity! Maximum 4 players allowed`);
            socket.emit('roomFull', { message: 'Room is at maximum capacity (4 players max)' });
            return null;
        }

        var player = Player({
            username:username,
            id:socket.id,
            socket:socket,
            room:room,
            x:0, // Not used in behavioral experiment
            y:0, // Not used in behavioral experiment  
            inventory:progress,
            startingContinent:"", // Not used in behavioral experiment
            admin:admin,
        });

        if (!player) {
            console.error('❌ Failed to create player object');
            socket.emit('error', { message: 'Failed to create player' });
            return;
        }

        player.inventory = new Inventory(progress.items,socket,true);
        player.inventory.refreshRender();

        console.log(`🧠 ${player.username} joined behavioral experiment in room: ${player.room}`);
        
        // Create or get game session for this room
        const gameSession = GameSession.create(room);
        
        if (!gameSession) {
            console.error('❌ Failed to create/get game session for room:', room);
            socket.emit('error', { message: 'Failed to create game session' });
            return;
        }
        
        // Always show triad status and allow experiment to start with 1+ players
        const allPlayersInRoom = Object.values(Player.list).filter(p => p.room === room);
        const humanPlayers = allPlayersInRoom.filter(p => !p.isAI);
        console.log(`👥 Current players in room ${room}: ${allPlayersInRoom.length}/3 (${humanPlayers.length} human, ${allPlayersInRoom.length - humanPlayers.length} AI)`);
        
        // Assign poker table positions immediately when any player joins
        GameSession.assignTriadPositions(room);
        
        // Always set to ready state for flexible testing
        gameSession.gameState = 'ready';
    
    // Notify all human players (AI players don't need notifications)
    humanPlayers.forEach(p => {
        if (p.socket && typeof p.socket.emit === 'function') {
            p.socket.emit('triadComplete', {
                message: `Experiment ready to begin! (${allPlayersInRoom.length}/3 players)`,
                playerPosition: p.triadPosition || allPlayersInRoom.findIndex(ap => ap.id === p.id) + 1,
                gameSession: {
                    currentRound: gameSession.currentRound,
                    maxRounds: gameSession.maxRounds,
                    condition: gameSession.currentCondition.name,
                    grid: gameSession.grid,
                    canAddAI: allPlayersInRoom.length < 3,
                    totalPlayers: allPlayersInRoom.length,
                    players: allPlayersInRoom.map(player => ({
                        id: player.id,
                        username: player.username,
                        triadPosition: player.triadPosition,
                        seatPosition: player.seatPosition,
                        isAI: player.isAI,
                        behaviorType: player.behaviorType
                    }))
                }
            });
        } else {
            console.warn(`⚠️ Player ${p.username} has invalid socket, skipping triadComplete notification`);
        }
    });
    if(allPlayersInRoom.length === 3) {
        console.log(`🎯 Triad complete in ${room}! Initializing behavioral experiment...`);
        
        // Assign positions (P1, P2, P3) for turn order
        GameSession.assignTriadPositions(room);
        
        // Set game state to ready
        gameSession.gameState = 'ready';
        
        // Notify all human players in room that experiment can begin (skip AI players)
        allPlayersInRoom.forEach(p => {
            if (p.socket && typeof p.socket.emit === 'function' && !p.isAI) {
                p.socket.emit('triadComplete', {
                    message: 'Triad complete! Experiment ready to begin.',
                    playerPosition: p.triadPosition,
                    gameSession: {
                        currentRound: gameSession.currentRound,
                        maxRounds: gameSession.maxRounds,
                        condition: gameSession.currentCondition.name,
                        grid: gameSession.grid,
                        totalPlayers: allPlayersInRoom.length,
                        players: allPlayersInRoom.map(player => ({
                            id: player.id,
                            username: player.username,
                            triadPosition: player.triadPosition,
                            seatPosition: player.seatPosition,
                            isAI: player.isAI,
                            behaviorType: player.behaviorType
                        }))
                    }
                });
            } else if (p.isAI) {
                console.log(`🤖 Skipping notification for AI player: ${p.username}`);
            }
        });
    }

    // Behavioral experiment event handlers (replace old key press handlers)
    socket.on('makeChoice', function(data) {
        // Player makes impulsive (odd row) or self-control (even row) choice
        const gameSession = GameSession.get(room);
        if (!gameSession || gameSession.gameState !== 'playing') {
            socket.emit('error', { message: 'Game not in progress' });
            return;
        }
        
        // Check if this player is the moderator (moderators can't vote)
        const currentRoom = roomList.find(r => r.name === room);
        const isModerator = currentRoom && player.username === currentRoom.creator;
        
        if (isModerator) {
            socket.emit('error', { message: 'Moderators cannot vote in the experiment' });
            return;
        }
        
        // Only process if this is a lock-in
        if (data.lockedIn) {
            player.currentChoice = data.choice; // 'impulsive' or 'self-control'
            player.isLockedIn = true;
            console.log(`🔒 ${player.username} locked in choice: ${data.choice}`);
            
            // Check if all non-moderator players have locked in their choices
            const roomPlayers = Object.values(Player.list).filter(p => p.room === room);
            const votingPlayers = roomPlayers.filter(p => {
                const playerRoom = roomList.find(r => r.name === room);
                return !(playerRoom && p.username === playerRoom.creator); // Exclude moderator
            });
            
            const allLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            console.log(`🎯 Lock-in status: ${votingPlayers.filter(p => p.isLockedIn).length}/${votingPlayers.length} players locked in`);
            
            // AI players auto-lock-in when they make decisions
            if (!allLockedIn) {
                // Trigger AI players to make their decisions and auto-lock-in
                AIPlayer.processAIDecisions(room, gameSession);
            }
            
            // Check again after AI processing
            const allFinallyLockedIn = votingPlayers.every(p => p.isLockedIn && p.currentChoice !== null);
            
            if (allFinallyLockedIn) {
                console.log(`🎯 All players locked in! Processing round...`);
                // Small delay to ensure all UI updates are complete
                setTimeout(() => {
                    processRound(room, gameSession);
                }, 500);
            }
        } else {
            // Just a selection, not a lock-in yet
            console.log(`🎯 ${player.username} selected (not locked): ${data.choice}`);
        }
    });

    // Legacy map change handler (keep for compatibility but not used in behavioral experiment)
    socket.on('changeMap',function(data){
        // Disabled for behavioral experiment
        console.log(`🚫 Map change disabled in behavioral experiment mode`);
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
    
    } catch (error) {
        console.error('❌ Error in Player.onGameStart:', error, 'for user:', username, 'room:', room);
        socket.emit('error', { message: 'Error joining game' });
    }
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

// Behavioral Economics Round Processing Functions
function startNewRound(roomName, gameSession) {
    if (!gameSession) return;
    
    console.log(`🔄 Starting round ${gameSession.currentRound} in room ${roomName}`);
    
    // Reset player choices and lock-in status for new round
    const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
    roomPlayers.forEach(p => {
        p.currentChoice = null;
        p.isLockedIn = false; // Reset lock-in status for new round
    });
    
    // Notify all human players about the new round and reset UI
    roomPlayers.forEach((player, index) => {
        if (player.socket) { // Only notify human players with real sockets
            const currentRoom = roomList.find(r => r.name === roomName);
            const isModerator = currentRoom && player.username === currentRoom.creator;
            
            // In behavioral experiments, all non-moderator players can vote simultaneously
            const canVote = !isModerator && !player.isAI; // Human participants can vote
            
            player.socket.emit('yourTurn', {
                isYourTurn: canVote, // All participants can vote, not turn-based
                isModerator: isModerator,
                activePlayer: canVote ? player.username : 'Round ' + gameSession.currentRound,
                round: gameSession.currentRound,
                condition: gameSession.currentCondition.name,
                grid: gameSession.grid,
                playerPosition: player.triadPosition,
                totalPlayers: roomPlayers.length
            });
            console.log(`🎯 Sent yourTurn for round ${gameSession.currentRound} to ${player.username} (canVote: ${canVote}, moderator: ${isModerator})`);
        }
    });
    
    // Trigger AI decisions for the new round
    const aiPlayersInRoom = roomPlayers.filter(p => p.isAI);
    if (aiPlayersInRoom.length > 0) {
        console.log(`🤖 Found ${aiPlayersInRoom.length} AI players for round ${gameSession.currentRound}, triggering their decisions...`);
        setTimeout(() => {
            AIPlayer.processAIDecisions(roomName, gameSession);
        }, AIPlayer.decisionDelay);
    }
}

function processRound(roomName, gameSession) {
    const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
    console.log(`⚙️ Processing round ${gameSession.currentRound} in room ${roomName}`);
    
    // Calculate tokens based on choices
    let whiteTokensAwarded = 0;
    let blackTokensAwarded = 0;
    let culturantProduced = false;
    
    // Check if all players chose self-control (even row) = culturant
    const allSelfControl = roomPlayers.every(p => p.currentChoice === 'self-control');
    
    roomPlayers.forEach(player => {
        // Award white tokens based on choice
        if (player.currentChoice === 'impulsive') {
            player.whiteTokens += 3;
            whiteTokensAwarded += 3;
        } else if (player.currentChoice === 'self-control') {
            player.whiteTokens += 1;
            whiteTokensAwarded += 1;
        }
        
        // Award black token if all chose self-control
        if (allSelfControl) {
            player.blackTokens += 1;
            blackTokensAwarded += 1;
        }
        
        player.roundsPlayed++;
    });
    
    // Deduct white tokens from global pool
    GlobalTokenPool.whiteTokens -= whiteTokensAwarded;
    
    // Track culturant production
    if (allSelfControl) {
        gameSession.culturantsProduced++;
        culturantProduced = true;
        console.log(`🎯 Culturant produced! Total: ${gameSession.culturantsProduced}`);
    }
    
    // Convert tokens to money based on current condition
    roomPlayers.forEach(player => {
        const whiteValue = player.whiteTokens * gameSession.currentCondition.whiteTokenValue;
        const blackValue = player.blackTokens * gameSession.currentCondition.blackTokenValue;
        player.totalEarnings = whiteValue + blackValue;
    });
    
    // Log data for export
    gameSession.dataLog.push({
        timestamp: new Date().toISOString(),
        round: gameSession.currentRound,
        condition: gameSession.currentCondition.name,
        players: roomPlayers.map(p => ({
            username: p.username,
            choice: p.currentChoice,
            whiteTokens: p.whiteTokens,
            blackTokens: p.blackTokens,
            earnings: p.totalEarnings
        })),
        culturantProduced: culturantProduced,
        whiteTokensRemaining: GlobalTokenPool.whiteTokens
    });
    
    // Send round results to all human players
    roomPlayers.forEach(player => {
        if (player.socket) { // Only notify human players
            player.socket.emit('roundResult', {
                round: gameSession.currentRound,
                choices: roomPlayers.map(p => ({ 
                    username: p.username, 
                    choice: p.currentChoice, 
                    isAI: p.isAI || false 
                })),
                tokensAwarded: {
                    white: player.currentChoice === 'impulsive' ? 3 : 1,
                    black: allSelfControl ? 1 : 0
                },
                totalTokens: {
                    white: player.whiteTokens,
                    black: player.blackTokens
                },
                totalEarnings: player.totalEarnings,
                culturantProduced: culturantProduced,
                whiteTokensRemaining: GlobalTokenPool.whiteTokens
            });
        }
    });
    
    // Check end conditions
    if (gameSession.currentRound >= gameSession.maxRounds || GlobalTokenPool.whiteTokens <= 0) {
        endExperiment(roomName, gameSession);
    } else {
        // Start next round after delay
        gameSession.currentRound++;
        setTimeout(() => startNewRound(roomName, gameSession), 3000); // 3 second delay
    }
}

function endExperiment(roomName, gameSession) {
    console.log(`🏁 Ending experiment in room ${roomName} after ${gameSession.currentRound} rounds`);
    gameSession.gameState = 'finished';
    
    const roomPlayers = Object.values(Player.list).filter(p => p.room === roomName);
    
    // Calculate final payouts
    const finalResults = roomPlayers.map(player => ({
        username: player.username,
        whiteTokens: player.whiteTokens,
        blackTokens: player.blackTokens,
        totalEarnings: player.totalEarnings,
        roundsPlayed: player.roundsPlayed
    }));
    
    // Send final results to all human players
    roomPlayers.forEach(player => {
        if (player.socket) { // Only notify human players
            player.socket.emit('experimentEnd', {
                finalResults: finalResults,
                totalRounds: gameSession.currentRound,
                culturantsProduced: gameSession.culturantsProduced,
                sessionDuration: new Date() - gameSession.sessionStartTime,
                exportData: gameSession.dataLog // For CSV export
            });
        }
    });
}

// Export data function (can be called by admin)
function exportGameData(roomName) {
    const gameSession = GameSession.get(roomName);
    if (!gameSession) return null;
    
    return {
        sessionInfo: {
            roomName: roomName,
            startTime: gameSession.sessionStartTime,
            totalRounds: gameSession.currentRound,
            culturantsProduced: gameSession.culturantsProduced,
            finalCondition: gameSession.currentCondition.name
        },
        dataLog: gameSession.dataLog
    };
}
