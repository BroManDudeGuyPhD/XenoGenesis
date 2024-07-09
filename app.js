var mongojs = require("mongojs");
var db = mongojs('localhost:27017/xenogenesis',['account','progress']);

const express = require('express');
const app = express();
const serv = require('http').Server(app);

app.get('/',function(req, res){
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);


var SOCKET_LIST = {};

var Entity = function () {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
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

var Player = function (id) {
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;
    self.hp = 100;
    self.hpMax = 100;
    self.score = 0;

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
            id: self.id,
            x: self.x,
            y: self.y,
            number: self.number,
            hp:self.hp,
            hpMax:self.hpMax,
            score:self.score,
        };
    }

    self.getUpdatePack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            hp:self.hp,
            score:self.score,
        };
    }

    Player.list[id] = self;

    initPack.player.push(self.getInitPack());

    return self;
}

Player.list = {};

Player.onConnect = function(socket){
    var player = Player(socket.id);

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

    socket.emit('init',{
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
                Player.onConnect(socket);
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

    socket.on('sendMsgToServer', function(data){
        var playerName = (""+socket.id).slice(2,7);
        for(var i in SOCKET_LIST){
            SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data);
        }
    });

    socket.on('evalServer', function(data){
        var res = eval(data);
        socket.emit('evalAnswer',res);
    });

});

var initPack = {player:[]};
var removePack = {player:[]};

setInterval(function(){
    var pack = {
        player:Player.update(),
    }

    for(var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('init',initPack);
        socket.emit('update',pack);
        socket.emit('remove',removePack);
    }

    initPack.player = [];
    removePack.player = [];
},1000/60);

