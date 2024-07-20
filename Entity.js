var initPack = {player:[]};
var removePack = {player:[]};

require('./client/Inventory')

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
    self.inventory = new Inventory(param.progress.items,param.socket,true);
    self.socket = param.socket;
    
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



////
// Player Connects
Player.onConnect = function(socket,username,progress){
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

    console.log(startingLocation)
    console.log(x)
    console.log(y)

    var player = Player({
        username:username,
        id:socket.id,
        socket:socket,
        map:map,
        x:x,
        y:y,
        startingContinent:startingLocation,
        progress:progress,
    });

    player.inventory.refreshRender();

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
        if(player.map === 'snow'){
            player.map = 'forest';
            player.inventory.addItem("potion",1);
        }
            
        else{
            player.map = 'snow';
            player.inventory.addItem("potion",1);
        }
            
    });

    //Player Sockets
    socket.on('sendMsgToServer', function(data){
        for(var i in Player.list){
            Player.list[i].socket.emit('addToChat',{ 
                message: player.username + ': ' + data,
                type:'normal'
            });
        }
    });

    socket.on('sendPmToServer', function(data){
        var recipientSocket = null;

        for(var i in Player.list)  
            if(Player.list[i].username === data.username)
                recipientSocket = Player.list[i].socket;
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
    let player = Player.list[socket.id];
    if(!player)
        return;
    Database.savePlayerProgress({
        username:player.username,
        items:player.inventory.items,
    })
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
