// Variables
const socket = io();

// Chat Objects
const chatForm = document.getElementById('chat-form');
const globalChatMessages = document.getElementById('globalChatDiv');
const globalNameText = document.getElementById('global-name');
const roomChatMessages = document.getElementById('roomChatDiv');
var roomNameText = document.getElementById('room-name');
var userList = document.getElementById('users');
var userCount = document.getElementById('userCount');

globalNameText.style.backgroundColor = "green";

// Login logic
var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('username');
var signDivPassword = document.getElementById('password');
var signDivSignIn = document.getElementById('signIn');
var signDivSignUp = document.getElementById('signUp');
var chatDiv = document.getElementById('chat-container');
var landingPage = document.getElementById('landingPage');
var backgroundIMG = document.getElementById('backgroundIMG');

// Modal Login
var modal = document.getElementById('id01');
var loginButton = document.getElementById('loginNav');

// Buttons
var createRoomButton = document.getElementById('create-btn');
var joinRoomButton = document.getElementById('join-btn');
var startGameButton = document.getElementById('start-btn');

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

loginButton.onclick = function(event) {
    document.getElementById('id01').style.display='block';
    document.getElementById("username").focus();
    //socket.emit('signIn', { username: "bob", password: "pass" });
}


signDivSignIn.onclick = function () {
    socket.emit('signIn', { username: signDivUsername.value, password: signDivPassword.value });
    modal.style.display = "none";
    closeMenu()
}

signDivSignUp.onclick = function () {
    socket.emit('signUp', { username: signDivUsername.value, password: signDivPassword.value });
    modal.style.display = "none";
    closeMenu()
}

// Listen for Enter kepress on signin input
signDivPassword.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        signDivSignIn.click();
    }
});

// Join chatroom
socket.on('signInResponse', function (data) {
    if (data.success) {
        //signDiv.style.display = 'none';
        landingPage.style.display = "none";
        loginButton.style.display = "none";
        chatDiv.style.display = '';
        socket.emit('joinRoom', 'Global');
    }

    else
        alert("Sign in unsuccessul.");
});

socket.on('signUpResponse', function (data) {
    if (data.success) {
        alert("Sign up successul.");
    }
    else
        alert("Sign up unsuccessul.");
});

// Get room and users
socket.on('roomUsers', ({ room, users, usersCount }) => {
    //outputRoomName(room);
    outputUsers(users);
    userCount.innerText = ` Users:    ${usersCount} online`
});

// Message from server
socket.on('message', (message) => {
    outputMessage(message);

    // Scroll down
    globalChatMessages.scrollTop = globalChatMessages.scrollHeight;
    roomChatMessages.scrollTop = roomChatMessages.scrollHeight;
});

socket.on('roomCreated', (roomName) => {
    console.log("Room Created: "+roomName)
    roomNameText.style.display ="";
    socket.emit('joinRoom', roomName );
    roomNameText.innerText = roomName;
})


// Message submit
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();

    //Determine what chat to send message to based on what room is visible
    let roomName = "Global"
    console.log(globalNameText.style)
    if(globalChatMessages.style.display.match("none")){
        roomName = roomNameText.innerText;
    }

    // Get message text
    let msg = e.target.elements.msg.value;
    msg = msg.trim();

    if (!msg)
        return false;
    
    // Clear input
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();

    // if (msg[0] === '/')
    //     socket.emit('evalServer', msg.slice(1));

    if(msg[0]==='@'){
        socket.emit('privateMessage',{
            recipient:msg.slice(1,msg.indexOf(':')),
            message:msg.slice(msg.indexOf(':') + 1),
            room:roomName
        });
    }

    else if(msg[0]==='.'){
        socket.emit('commandMessage',{
            message:msg.replaceAll(".",""),
            room:roomName
        });
    }

    else
        socket.emit('chatMessage', {
            msg:msg,
            room:roomName
        });

});

globalNameText.onclick = function(){
    roomChatMessages.style.display = "none";
    roomNameText.style.backgroundColor = "#667aff"
    globalChatMessages.style.display = "";
    globalNameText.style.backgroundColor = "green";
    
}

roomNameText.onclick = function(){
    globalChatMessages.style.display = "none";
    globalNameText.style.backgroundColor = "#667aff"
    roomChatMessages.style.display = "";
    roomNameText.style.backgroundColor = "green";
    
}

// Output message to DOM
function outputMessage(message) {

if(message.type == "broadcast"){
    console.log("Broadcast")
    //If message is a broadcast, send to ALL rooms
    const div = document.createElement('div');
    div.id = message.username;
    div.classList.add('message');
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    switch (message.admin) {
        case true:
            p.style.color = "magenta";
            p.innerText = message.username + "  (admin)";
            break;
    }
    p.innerHTML += `<span>  ${message.time}</span>`;
    p.style.fontSize = "12px"
    div.appendChild(p);
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    switch (message.type) {
        case "status":
            para.style.color = "green";
            break;
        case "broadcast":
            para.style.color = "yellow";
            break;
        case "pm":
            para.style.color = "magenta";
            break;
    }
    div.appendChild(para)
    document.getElementById("globalChatDiv").appendChild(div);
    document.getElementById("roomChatDiv").appendChild(div);
    return;
}

let roomNameDiv = "globalChatDiv";
let chatMessages = globalChatMessages;

if(message.room !== "Global"){
    roomNameDiv = "roomChatDiv"
    chatMessages = roomChatMessages
}

    // If the previous message was sent by them same user, combine the message div, otherwise seperate
    if (chatMessages.childNodes.length >= 1) {
        let lastMessage = chatMessages.lastElementChild
        if (lastMessage.id == message.username) {
            const p = document.createElement('p');
            p.classList.add('meta');

            const para = document.createElement('p');
            para.classList.add('text');
            para.innerText = message.text;
            switch (message.type) {
                case "status":
                    para.style.color = "green";
                    break;
                case "pm":
                    para.style.color = "magenta";
                    break;
            }
            chatMessages.lastElementChild.appendChild(para)
            return;
        }
    }

    const div = document.createElement('div');
    div.id = message.username;
    div.classList.add('message');
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    switch (message.admin) {
        case true:
            p.style.color = "magenta";
            p.innerText = message.username + "  (admin)";
            break;
    }
    p.innerHTML += `<span>  ${message.time}</span>`;
    p.style.fontSize = "12px"
    div.appendChild(p);
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    switch (message.type) {
        case "status":
            para.style.color = "green";
            break;
        case "broadcast":
            para.style.color = "yellow";
            break;
        case "pm":
            para.style.color = "magenta";
            break;
    }
    div.appendChild(para)
    document.getElementById(roomNameDiv).appendChild(div);


}

// Add room name to DOM
function outputRoomName(room) {
    roomNameText.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
    userList.innerHTML = '';
    users.forEach((user) => {
        const li = document.createElement('li');
        li.innerText = user.username;
        userList.appendChild(li);
    });
}

//Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
    globalChat = document.getElementById('globalChatDiv');
    console.log(globalChat);

    if(globalChat.style.display == "none"){
        console.log("NOT global chat")
        roomName = roomNameText.innerText;
        socket.emit('leaveRoom', roomNameText.innerText);
        roomNameText.style.display ="none";
        createRoomButton.style.display = "";
        startGameButton.style.display = "none";
    }
    
    else{
        const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
        if (leaveRoom) {
            signDiv.style.display = '';
            chatDiv.style.display = 'none';
            socket.emit('leaveRoom', "Global");
        } else {
        }
    }
        
});

//Create new room with a static name, this will be a join game button soon
createRoomButton.addEventListener('click', () => {
    socket.emit("createRoom");
    roomNameText.click();
    createRoomButton.style.display = "none";
    startGameButton.style.display = "";
});

joinRoomButton.addEventListener('click', () => {
    let roomName = prompt("Enter room name", '');
    socket.emit('joinRoom', roomName);
});

startGameButton.addEventListener('click', () => {
    socket.emit('startGame', {room:roomNameText.innerText});
    gameDiv.style.display = 'inline-block';

});

socket.on("joinRoom", (room) => {
    roomNameText.style.display ="";
    globalChatMessages.style.display = "none";
    globalNameText.style.backgroundColor = "#667aff"
    roomChatMessages.style.display = "";
    roomNameText.style.backgroundColor = "green";
});

socket.on("gameStarted", function(){
    socket.emit('beginGame', roomName);
})



//Remove
socket.on('remove', function (data) {
    for (var i = 0; i < data.player.length; i++) {
        delete Player.list[data.player[i]];
    }
});



// HTML Design
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

hamburger.addEventListener("click", mobileMenu);

function mobileMenu() {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
}


const navLink = document.querySelectorAll(".nav-link");

navLink.forEach(n => n.addEventListener("click", closeMenu));

function closeMenu() {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
}


var changeMap = function(){
    console.log("Change Map")
    socket.emit('changeMap');
}

//Game
var Img = {};
Img.player = new Image();
Img.player.src = '/client/img/player.png';

Img.map = {};
Img.map['forest'] = new Image();
Img.map['forest'].src = '/client/img/map.png';
Img.map['snow'] = new Image();
Img.map['snow'].src = '/client/img/snowMap.png';


var ctx = document.getElementById("ctx").getContext("2d");
var ctxUi = document.getElementById("ctx-ui").getContext("2d");
ctx.font = '30px Arial';

var Player = function (initPack) {
    var self = {};
    self.id = initPack.id;
    self.number = initPack.number;
    self.x = initPack.x;
    self.y = initPack.y;
    self.hp = initPack.hp;
    self.hpMax = initPack.hpMax;
    self.score = initPack.score;
    self.map = initPack.map;

    self.draw = function(){
        var hpWidth = 50 * self.hp / self.hpMax;

        //HP Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(self.x - 40, self.y - 70,hpWidth,4);

        //Player Image
        var width = Img.player.width;
        var height = Img.player.height;

        ctx.drawImage(Img.player,
            0, 0, Img.player.width, Img.player.height,
            self.x - width / 2, self.y - height / 2, width, height);

        //Score
        //ctx.fillText(self.score,self.x,self.y-60)
    }

    Player.list[self.id] = self;
    return self;
}

Player.list = {};
var selfId = null;

//Initialize
socket.on('init', function(data) {
    if(data.selfId){
        selfId = data.selfId;
    }
    for (var i = 0; i < data.player.length; i++) {
        new Player(data.player[i]);
    }
});


//Update
socket.on('update', function(data) {
    for (var i = 0; i < data.player.length; i++) {
        var pack = data.player[i];
        var p = Player.list[pack.id];
        if (p) {
            if (pack.x !== undefined)
                p.x = pack.x;
            if (pack.y !== undefined)
                p.y = pack.y;
            if (pack.hp !== undefined)
                p.hp = pack.hp;
            if (pack.score !== undefined)
                p.score = pack.score;
            if (pack.map !== undefined)
                p.map = pack.map;
        }
    }
});

//Remove
socket.on('remove', function (data) {
    for (var i = 0; i < data.player.length; i++) {
        delete Player.list[data.player[i]];
    }
});

//Draw Map
var drawMap = function(){
    var player = Player.list[selfId];
    ctx.drawImage(Img.map[player.map],0,0);
}

//Draw GAME

var drawScore = function(){
    if(lastScore === Player.list[selfId].score)
        return;
    
    lastScore = Player.list[selfId].score;
    ctxUi.clearRect(0, 0, 500, 500);
    ctxUi.fillStyle = 'white';
    ctxUi.font = "20px Arial";
    ctxUi.fillText("Score: "+Player.list[selfId].score,0,30);
}

var lastScore = -1;

setInterval(function () {
    //Do not draw map or player info until player is logged in
    if(!selfId)
        return;

    ctx.clearRect(0, 0, 800, 1600);
    drawMap();
    drawScore();
    for (var i in Player.list)
        Player.list[i].draw();
}, 20);


document.onkeydown = function (event) {
    if (event.keyCode === 68) //d
        socket.emit('keyPress', { inputId: 'right', state: true });
    else if (event.keyCode === 83) //s
        socket.emit('keyPress', { inputId: 'down', state: true });
    else if (event.keyCode === 65) //a
        socket.emit('keyPress', { inputId: 'left', state: true });
    else if (event.keyCode === 87) // w
        socket.emit('keyPress', { inputId: 'up', state: true });
}

document.onkeyup = function (event) {
    if (event.keyCode === 68) //d
        socket.emit('keyPress', { inputId: 'right', state: false });
    else if (event.keyCode === 83) //s
        socket.emit('keyPress', { inputId: 'down', state: false });
    else if (event.keyCode === 65) //a
        socket.emit('keyPress', { inputId: 'left', state: false });
    else if (event.keyCode === 87) // w
        socket.emit('keyPress', { inputId: 'up', state: false });

//Block right-click
document.oncontextmenu = function(event){
    event.preventDefault();
}


}