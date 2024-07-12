var mongojs = require("mongojs");
var db = mongojs('localhost:27017/xenogenesis',['account','progress']);

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

var SOCKET_LIST = {};

////
// Variables

var continentCoords = {
    NorthEast:{
        x:1400,
        y:200,
    },
    NorthWest:{
        x:300,
        y:200,
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
        x:800,
        y:400,
    },
}

Player.list = {};

////
// Player Connects
Player.onConnect = function(socket,username){
    var map = 'forest';

    const continents = ["NorthWest", "NorthEast", "SouthEast", "SouthWest","Middle"];
    const startingLocation = continents[Math.floor(Math.random() * continents.length)];
    var x,y
    

    for(place in continentCoords){
        if(place === startingLocation){
            x = continentCoords[place].x;
            y = continentCoords[place].y;
        }
    }

    console.log(startingLocation)
    console.log(x)
    console.log(y)

    var player = Player({
        username:username,
        id:socket.id,
        map:map,
        x:x,
        y:y,
        startingContinent:startingLocation,
    });

    //Key Presses
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
        if(player.map === 'snow')
            player.map = 'forest';
        else
            player.map = 'snow';
    });

    //Player Sockets
    socket.on('sendMsgToServer', function(data){
        for(var i in SOCKET_LIST){
            SOCKET_LIST[i].emit('addToChat',{ 
                message: player.username + ': ' + data,
                type:'normal'
            });
        }
    });

    socket.on('sendPmToServer', function(data){
        var recipientSocket = null;

        for(var i in Player.list)  
            if(Player.list[i].username === data.username)
                recipientSocket = SOCKET_LIST[i];
        if(recipientSocket === null){
            socket.emit('addToChat',{ 
                message: 'The player '+data.username+' is not online',
                type:'status'
            });
        } else{
            //recipientSocket.emit('addToChat','From '+player.username+': '+data.message);
            //socket.emit('addToChat','PM sent to: '+data.username);


            recipientSocket.emit('addToChat',{ 
                message: 'From '+player.username+': '+data.message,
                type:'pm'
            });

            socket.emit('addToChat',{ 
                message: 'PM sent to: '+data.username,
                type:'status'
            });
        }
    });

    socket.on('evalServer', function(data){
        var res = eval(data);
        socket.emit('evalAnswer',res);
    });

    socket.emit('init',{
        selfId:socket.id,
        player:Player.getAllInitPack(),
    })
}

Player.getAllInitPack = function(){
    var players = [];
    for (var i in Player.list)
        players.push(Player.list[i].getInitPack());
    return players;
}

Player.onDisconnect = function(socket){
    removePack = Entity.getFrameUpdateData().removePack;
    delete Player.list[socket.id];
    removePack.player.push(socket.id);
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

var isValidPassword = function(data,cb){
    db.account.find({username:data.username,password:data.password}, function(err,res){
        if(res.length > 0)
            cb(true);
        else
            cb(false);
    });
    
}

var isUsernameTaken = function(data,cb){
    db.account.find({username:data.username}, function(err,res){
        if(res.length > 0)
            cb(true);
        else
            cb(false);
    });
    
}

var addUser = function(data,cb){
    db.account.insert({username:data.username,password:data.password}, function(err){
        cb();
    });
    
}

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
        isValidPassword(data, function(res){
            if (res) {
                Player.onConnect(socket,data.username);
                socket.emit('signInResponse', { success: true });
            } else {
                socket.emit('signInResponse', { success: false });
            }
        });
    });

    socket.on('signUp', function(data) {
        isUsernameTaken(data, function(res){
            if (res) {
                socket.emit('signUpResponse', { success: false });
            } else {
                addUser(data,function(){
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

