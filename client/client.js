// Variables
const socket = io();

// Chat Objects
const chatForm = document.getElementById('chat-form');
const globalChatMessages = document.getElementById('globalChatDiv');
const globalNameText = document.getElementById('global-name');
const roomChatMessages = document.getElementById('roomChatDiv');
var roomNameText = document.getElementById('room-name');
const userList = document.getElementById('users');

globalNameText.style.backgroundColor = "green";

//Login logic
var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('username');
var signDivPassword = document.getElementById('password');
var signDivSignIn = document.getElementById('signIn');
var signDivSignUp = document.getElementById('signUp');
var chatDiv = document.getElementById('chat-container');
var landingPage = document.getElementById('landingPage');
var backgroundIMG = document.getElementById('backgroundIMG');

//Modal Login
var modal = document.getElementById('id01');
var loginButton = document.getElementById('loginNav');

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
socket.on('roomUsers', ({ room, users }) => {
    outputRoomName(room);
    outputUsers(users);
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
})

socket.on('leaveRoom',(roomName) =>{
    roomNameText.style.display ="none";
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
document.getElementById('create-btn').addEventListener('click', () => {
    socket.emit("createRoom");
    roomNameText.click();
});

document.getElementById('join-btn').addEventListener('click', () => {
    let roomName = prompt("Enter room name", '');
    socket.emit('joinRoom', roomName);
});

socket.on("joinRoom", (room) => {
    roomNameText.style.display ="";
    globalChatMessages.style.display = "none";
    globalNameText.style.backgroundColor = "#667aff"
    roomChatMessages.style.display = "";
    roomNameText.style.backgroundColor = "green";
});



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