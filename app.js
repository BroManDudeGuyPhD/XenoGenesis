require('./Database');
require('./Entity');
require('./client/Inventory')

const express = require('express');
const path = require('path');
const http = require("http");
const app = express();
const server = http.createServer(app);
const socketio = require("socket.io");
const io = socketio(server, {
    // Increase timeout settings to prevent disconnections during round processing
    pingTimeout: 60000,  // 60 seconds (default is 5 seconds)
    pingInterval: 25000  // 25 seconds (default is 25 seconds)
});

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
    res.render('login');
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
    SOCKET_LIST[socket.id] = socket;

    socket.on('signIn', function(data) {
        Database.isValidPassword(data, function(res){
            if (!res) 
                return socket.emit('signInResponse', { success: false });

            // Database.getPlayerProgress(data.username,function(progress){
            //     socket.emit('signInResponse', { success: true });
            //     Player.onConnect(socket,data.username,io,progress);
            // })
            Database.isAdmin(data,function(admin){ 
                Player.onConnect(socket,data.username,admin,io);
                socket.emit('signInResponse', { success: true });
            })
            // Player.onConnect(socket,data.username,io);      
            // socket.emit('signInResponse', { success: true });   
        });
    });

    socket.on('signUp', function(data) {
        Database.isUsernameTaken(data, function(res){
            if (res) {
                socket.emit('signUpResponse', { success: false });
            } else {
                Database.addUser(data,function(){
                    socket.emit('signUpResponse', { success: true });
                });
            }
        });
    });

    socket.on('disconnect', function(){
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