require('./Database');
require('./Entity');
require('./client/Inventory')

// Store user room associations for logout/login restoration
const userRoomRestoration = new Map(); // username -> { room, timestamp, hasActiveGame }

const express = require('express');
const path = require('path');
const http = require("http");
const session = require('express-session');
const sharedsession = require('express-socket.io-session');

const app = express();
const server = http.createServer(app);

// Configure session middleware
const sessionMiddleware = session({
    secret: 'xenogenesis-secret-key-2025', // Change this to a random string in production
    resave: true, // Changed to true to ensure session is saved
    saveUninitialized: true, // Changed to true to create session even if not modified
    rolling: true, // Reset session expiry on each request
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true // Prevent XSS attacks
    },
    name: 'xenogenesis.sid' // Custom session name
});

// Apply session middleware to Express
app.use(sessionMiddleware);

const socketio = require("socket.io");
const io = socketio(server, {
    // Increase timeout settings to prevent disconnections during round processing
    pingTimeout: 60000,  // 60 seconds (default is 5 seconds)
    pingInterval: 25000  // 25 seconds (default is 25 seconds)
});

// Share session between Express and Socket.IO
io.use(sharedsession(sessionMiddleware, {
    autoSave: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/client/views/pages'));

// Configure static file serving with proper MIME types
app.use('/client', express.static(__dirname + '/client', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

app.get('/', function(req, res) {
    // Check if user has an active session and pass it to the client
    // Validate room if user has one in session
    let validatedRoom = req.session.room || 'Global';
    let roomExists = true;
    
    if (req.session.room && typeof roomList !== 'undefined') {
        const roomIndex = roomList.findIndex(room => 
            room.name.toLowerCase() === req.session.room.toLowerCase()
        );
        roomExists = roomIndex !== -1;
        
        if (!roomExists) {
            console.log(`⚠️ HTTP: Room "${req.session.room}" no longer exists, defaulting to Global`);
            validatedRoom = 'Global';
        }
    }
    
    const sessionData = {
        isLoggedIn: !!req.session.username,
        username: req.session.username || null,
        room: validatedRoom,
        roomRestored: roomExists
    };

    // Check for active game session if user is logged in and has a room
    if (req.session.username && validatedRoom && validatedRoom !== 'Global') {
        const Entity = require('./Entity.js');
        const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(validatedRoom);
        sessionData.hasActiveGame = hasActiveGame;
        console.log(`🎮 HTTP session check: Active game in "${validatedRoom}": ${hasActiveGame}`);
    } else {
        sessionData.hasActiveGame = false;
    }
    
    console.log('🌐 HTTP request session data:', sessionData);
    
    res.render('login', { 
        sessionData: JSON.stringify(sessionData)
    });
});

// Add session check endpoint
app.get('/api/session', function(req, res) {
    // Validate room if user has one in session
    let validatedRoom = req.session.room || 'Global';
    let roomExists = true;
    
    if (req.session.room && typeof roomList !== 'undefined') {
        const roomIndex = roomList.findIndex(room => 
            room.name.toLowerCase() === req.session.room.toLowerCase()
        );
        roomExists = roomIndex !== -1;
        
        if (!roomExists) {
            console.log(`⚠️ API: Room "${req.session.room}" no longer exists, defaulting to Global`);
            validatedRoom = 'Global';
        }
    }
    
    const sessionData = {
        isLoggedIn: !!req.session.username,
        username: req.session.username || null,
        room: validatedRoom,
        roomRestored: roomExists
    };

    // Check for active game session if user is logged in and has a room
    if (req.session.username && validatedRoom && validatedRoom !== 'Global') {
        const Entity = require('./Entity.js');
        const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(validatedRoom);
        sessionData.hasActiveGame = hasActiveGame;
        console.log(`🎮 API session check: Active game in "${validatedRoom}": ${hasActiveGame}`);
    } else {
        sessionData.hasActiveGame = false;
    }

    res.json(sessionData);
});

app.get('/about', function(req, res) {
    res.render('about');
});

// Remove game route - game interface should be embedded in main page

app.get('/globalChat', function(req, res) {
    res.render('globalChat');
});

server.listen(2000, () => console.log("------------ Server started ------------"));


////
// Variables
var SOCKET_LIST = {};


io.on('connection', (socket) => {
    console.log('🔌 New socket connection:', socket.id);
    SOCKET_LIST[socket.id] = socket;

    // IMMEDIATELY capture session data before any client actions can modify it
    let originalSessionRoom = null;
    if (socket.handshake.session && socket.handshake.session.username) {
        originalSessionRoom = socket.handshake.session.room;
    }

    // Add a small delay to ensure session data is properly loaded
    setTimeout(() => {
        // Check for existing session on connection        
        if (socket.handshake.session && socket.handshake.session.username) {
            console.log('🔄 Restoring session for user:', socket.handshake.session.username);
            
            // Use the ORIGINAL room we captured, not the potentially overwritten one
            let targetRoom = originalSessionRoom || 'Global';
            
            let roomExists = false;
            
            // Validate if the room still exists in roomList (roomList is global from Entity.js)
            if (typeof roomList !== 'undefined') {
                const roomIndex = roomList.findIndex(room => 
                    room.name.toLowerCase() === targetRoom.toLowerCase()
                );
                roomExists = roomIndex !== -1;
                
                if (roomExists) {
                    console.log(`✅ Room "${targetRoom}" still exists, will reconnect user`);
                } else {
                    console.log(`⚠️ Room "${targetRoom}" no longer exists, defaulting to Global`);
                    targetRoom = 'Global';
                }
            } else {
                console.log('⚠️ roomList not available, defaulting to Global');
                targetRoom = 'Global';
            }
            
            Database.isAdmin({ username: socket.handshake.session.username }, function(admin) {
                Player.onConnect(socket, socket.handshake.session.username, admin, io);
                
                // Check if there's an active game session in the target room
                const Entity = require('./Entity.js');
                const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(targetRoom);
                console.log(`🎮 Checking for active game in room "${targetRoom}": ${hasActiveGame}`);
                
                // Emit session restore event with validated room and game status
                socket.emit('sessionRestored', { 
                    success: true, 
                    username: socket.handshake.session.username,
                    room: targetRoom,
                    roomRestored: roomExists,
                    hasActiveGame: hasActiveGame
                });
            });
        } else {
            // Emit session invalid event to prompt re-login
            socket.emit('sessionInvalid', { 
                message: 'Session expired, please log in again' 
            });
        }
    }, 100); // 100ms delay

    socket.on('signIn', function(data) {
        console.log('🔐 Sign in attempt for:', data.username);
        
        Database.isValidPassword(data, function(res){
            if (!res) {
                console.log('❌ Invalid password for:', data.username);
                return socket.emit('signInResponse', { success: false });
            }
            
            // Store user data in session
            socket.handshake.session.username = data.username;
            socket.handshake.session.loginTime = new Date().toISOString();
            
            // Check for room restoration data after logout
            if (userRoomRestoration.has(data.username)) {
                const restorationData = userRoomRestoration.get(data.username);
                const age = Date.now() - restorationData.timestamp;
                const maxAge = 10 * 60 * 1000; // 10 minutes
                
                if (age < maxAge && restorationData.hasActiveGame) {
                    // Check if the game is still active
                    const Entity = require('./Entity.js');
                    const stillActive = Entity.hasActiveGameSession && Entity.hasActiveGameSession(restorationData.room);
                    
                    if (stillActive) {
                        socket.handshake.session.room = restorationData.room;
                        console.log(`🔄 Restored ${data.username} to room "${restorationData.room}" with active game`);
                        
                        // Save session first
                        socket.handshake.session.save((err) => {
                            if (err) {
                                console.error('❌ Session save error:', err);
                            }
                            
                            Database.isAdmin(data, function(admin){ 
                                Player.onConnect(socket, data.username, admin, io);
                                socket.emit('signInResponse', { success: true });
                                console.log('✅ Sign in response sent to client');
                                
                                // Trigger session restoration event for room restoration
                                socket.emit('sessionRestored', { 
                                    success: true, 
                                    username: data.username,
                                    room: restorationData.room,
                                    roomRestored: true,
                                    hasActiveGame: true
                                });
                            });
                        });
                        
                    } else {
                        socket.handshake.session.room = 'Global';
                        console.log(`⚠️ Game no longer active in "${restorationData.room}", defaulting ${data.username} to Global`);
                        
                        // Handle non-restoration case
                        socket.handshake.session.save((err) => {
                            if (err) {
                                console.error('❌ Session save error:', err);
                            }
                            
                            Database.isAdmin(data, function(admin){ 
                                Player.onConnect(socket, data.username, admin, io);
                                socket.emit('signInResponse', { success: true });
                                console.log('✅ Sign in response sent to client');
                            });
                        });
                    }
                    // Clean up restoration data after use
                    userRoomRestoration.delete(data.username);
                } else {
                    socket.handshake.session.room = 'Global';
                    console.log(`⚠️ Restoration data expired for ${data.username}, defaulting to Global`);
                    userRoomRestoration.delete(data.username);
                    
                    // Handle non-restoration case
                    socket.handshake.session.save((err) => {
                        if (err) {
                            console.error('❌ Session save error:', err);
                        }
                        
                        Database.isAdmin(data, function(admin){ 
                            Player.onConnect(socket, data.username, admin, io);
                            socket.emit('signInResponse', { success: true });
                            console.log('✅ Sign in response sent to client');
                        });
                    });
                }
            } else {
                socket.handshake.session.room = 'Global';
                console.log(`🌐 No restoration data found for ${data.username}, starting in Global`);
                
                // Handle non-restoration case
                socket.handshake.session.save((err) => {
                    if (err) {
                        console.error('❌ Session save error:', err);
                    }
                    
                    Database.isAdmin(data, function(admin){ 
                        Player.onConnect(socket, data.username, admin, io);
                        socket.emit('signInResponse', { success: true });
                        console.log('✅ Sign in response sent to client');
                    });
                });
            }
        });
    });

    socket.on('signUp', function(data) {
        Database.isUsernameTaken(data, function(res){
            if (res) {
                socket.emit('signUpResponse', { success: false });
            } else {
                Database.addUser(data, function(){
                    // Store user data in session after successful signup
                    socket.handshake.session.username = data.username;
                    socket.handshake.session.loginTime = new Date().toISOString();
                    socket.handshake.session.room = 'Global'; // New users start in Global
                    socket.handshake.session.save();
                    
                    socket.emit('signUpResponse', { success: true });
                });
            }
        });
    });

    socket.on('logout', function() {
        console.log('🔓 User logging out:', socket.handshake.session.username);
        
        // Store user's room information for potential restoration after re-login
        if (socket.handshake.session && socket.handshake.session.username && socket.handshake.session.room) {
            const username = socket.handshake.session.username;
            const currentRoom = socket.handshake.session.room;
            
            if (currentRoom !== 'Global') {
                const Entity = require('./Entity.js');
                const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(currentRoom);
                
                if (hasActiveGame) {
                    // Store room information for restoration after re-login
                    userRoomRestoration.set(username, {
                        room: currentRoom,
                        timestamp: Date.now(),
                        hasActiveGame: true
                    });
                    console.log(`💾 Stored room restoration data for ${username}: room="${currentRoom}", activeGame=true`);
                } else {
                    // Remove any existing restoration data if no active game
                    userRoomRestoration.delete(username);
                    console.log(`�️ Cleared room restoration data for ${username} - no active game`);
                }
            } else {
                // Remove restoration data if user was in Global
                userRoomRestoration.delete(username);
            }
        }
        
        // Clear session data safely
        if (socket.handshake.session) {
            // Clear session properties instead of destroying
            socket.handshake.session.isLoggedIn = false;
            socket.handshake.session.username = null;
            socket.handshake.session.room = 'Global';
            socket.handshake.session.loginTime = null;
            socket.handshake.session.save(() => {
                socket.emit('logoutResponse', { success: true });
            });
        } else {
            socket.emit('logoutResponse', { success: true });
        }
    });

    socket.on('joinRoom', function(data) {
        // Store current room in session for persistence
        if (socket.handshake.session) {
            // Handle both string and object formats
            const roomName = typeof data === 'string' ? data : data.room;
            socket.handshake.session.room = roomName;
            socket.handshake.session.save();
            console.log('💾 Room saved to session:', roomName);
        }
    });

    socket.on('disconnect', function(){
        // Store user's room information for potential restoration (same logic as logout)
        if (socket.handshake.session && socket.handshake.session.username && socket.handshake.session.room) {
            const username = socket.handshake.session.username;
            const currentRoom = socket.handshake.session.room;
            
            if (currentRoom !== 'Global') {
                const Entity = require('./Entity.js');
                const hasActiveGame = Entity.hasActiveGameSession && Entity.hasActiveGameSession(currentRoom);
                
                if (hasActiveGame) {
                    // Store room information for restoration after re-login
                    userRoomRestoration.set(username, {
                        room: currentRoom,
                        timestamp: Date.now(),
                        hasActiveGame: true
                    });
                    console.log(`💾 Stored room restoration data on disconnect for ${username}: room="${currentRoom}", activeGame=true`);
                } else {
                    // Remove any existing restoration data if no active game
                    userRoomRestoration.delete(username);
                }
            }
        }
        
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket, io);
    });
});


////
// Main Loop
setInterval(function(){

    var packs = Entity.getFrameUpdateData();
    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        // Don't send init events in the main loop - they should only be sent on join/game start
        // socket.emit('init',packs.initPack);
        socket.emit('update',packs.updatePack);
        socket.emit('remove',packs.removePack);
    }

},1000/60);

module.exports = {io};