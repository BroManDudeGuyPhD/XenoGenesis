require('./Database');
require('./Entity');
require('./client/Inventory')

const express = require('express');
const path = require('path');
const http = require("http");
const app = express();
const server = http.createServer(app);
const socketio = require("socket.io");
const io = socketio(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/client/views/pages'));

// app.get('/',function(req, res){
//     res.render(__dirname + '/client/login');
// });

app.use('/client',express.static(__dirname + '/client'));

app.get('/', function(req, res) {
    res.render('login');
});

app.get('/about', function(req, res) {
    res.render('about');
});

app.get('/game', function(req, res) {
    res.render('game');
});

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
        socket.emit('init',packs.initPack);
        socket.emit('update',packs.updatePack);
        socket.emit('remove',packs.removePack);
    }

},1000/60);

module.exports = {io};