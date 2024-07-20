require('./Database');
require('./Entity');
require('./client/Inventory')

const express = require('express');
const app = express();
const serv = require('http').Server(app);

app.get('/',function(req, res){
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);


////
// Variables
var SOCKET_LIST = {};


var io = require('socket.io')(serv,{});

io.sockets.on('connection', function(socket){
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;
    
    // socket.on('signIn', function (data) {
    //     if (isValidPassword(data)) {
    //         Player.onConnect(socket);
    //         socket.emit('signInResponse', { success: true });
    //     } else {
    //         socket.emit('signInResponse', { success: false });
    //     }
    // });

    socket.on('signIn', function(data) {
        Database.isValidPassword(data, function(res){
            if (!res) 
                return socket.emit('signInResponse', { success: false });

            Database.getPlayerProgress(data.username,function(progress){
                Player.onConnect(socket,data.username,progress);
                socket.emit('signInResponse', { success: true });
            })          
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
        Player.onDisconnect(socket);
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

console.log("------------ Server started ------------");

