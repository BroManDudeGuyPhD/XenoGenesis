const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

// Get username and room from URL
// const { username, room } = Qs.parse(location.search, {
//     ignoreQueryPrefix: true,
// });

const socket = io();

//Login logic
var signDiv = document.getElementById('signDiv');
var signDivUsername = document.getElementById('username');
var signDivPassword = document.getElementById('password');
var signDivSignIn = document.getElementById('signIn');
var signDivSignUp = document.getElementById('signUp');
var chatDiv = document.getElementById('chat-container');

signDivSignIn.onclick = function () {
    socket.emit('signIn', { username: signDivUsername.value, password: signDivPassword.value });
}

signDivSignUp.onclick = function () {
    socket.emit('signUp', { username: signDivUsername.value, password: signDivPassword.value });
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
        signDiv.style.display = 'none';
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
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message submit
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();

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
            message:msg.slice(msg.indexOf(':') + 1)
        });
    }

    else if(msg[0]==='.'){
        socket.emit('commandMessage',{
            message:msg.replaceAll(".","")
        });
    }

    else
        socket.emit('chatMessage', msg);

});

// Output message to DOM
function outputMessage(message) {

    const div = document.createElement('div');
    div.classList.add('message');
    const p = document.createElement('p');
    p.classList.add('meta');
    p.innerText = message.username;
    switch (message.admin) {
        case true:
            p.style.color="magenta";
            p.innerText = message.username + "  (admin)";
            break;

    }
    p.innerHTML += `<span>  ${message.time}</span>`;
    div.appendChild(p);
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    switch (message.type) {
        case "status":
            para.style.color="green";
            break;
        case "pm":
            para.style.color="magenta";
            break;
    }
    div.appendChild(para);
    document.querySelector('.chat-messages').appendChild(div);
}


// Add room name to DOM
function outputRoomName(room) {
    roomName.innerText = room;
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
    if (roomName.innerText == "Global") {

        const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
        if (leaveRoom) {
            signDiv.style.display = '';
            chatDiv.style.display = 'none';
        } else {
        }
    }

    else
        socket.emit('joinRoom', 'Global');
});

//Create new room with a static name, this will be a join game button soon
document.getElementById('create-btn').addEventListener('click', () => {
    socket.emit('joinRoom', "Second Chat" );
});


//Initialize
// socket.on('init', function(data) {
//     if(data.selfId){
//         selfId = data.selfId;
//     }
//     for (var i = 0; i < data.player.length; i++) {
//         new Player(data.player[i]);
//     }
// });


// //Update
// socket.on('update', function(data) {
//     for (var i = 0; i < data.player.length; i++) {
//         var pack = data.player[i];
//         var p = Player.list[pack.id];
//         if (p) {
//             if (pack.x !== undefined)
//                 p.x = pack.x;
//             if (pack.y !== undefined)
//                 p.y = pack.y;
//             if (pack.hp !== undefined)
//                 p.hp = pack.hp;
//             if (pack.score !== undefined)
//                 p.score = pack.score;
//             if (pack.map !== undefined)
//                 p.map = pack.map;
//         }
//     }
// });

//Remove
socket.on('remove', function (data) {
    for (var i = 0; i < data.player.length; i++) {
        delete Player.list[data.player[i]];
    }
});