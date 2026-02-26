const io = require('socket.io-client');

const SERVER = 'http://localhost:2000';
const USERNAME = 'andre';
const PASSWORD = 'password';
const ROOM = 'LightningRoom';

const socket = io(SERVER, {
    transports: ['websocket'],
    reconnectionAttempts: 3
});

socket.on('connect', () => {
    console.log('Connected to server, socket id =', socket.id);

    // Attempt sign in
    console.log('Signing in as', USERNAME);
    socket.emit('signIn', { username: USERNAME, password: PASSWORD });

    // Fallback: after 3s, if not signed in, try emitting runSpeedTest anyway
    setTimeout(() => {
        if (!signedIn) {
            console.log('Sign in not confirmed; attempting to run lightning test anyway');
            runLightning();
        }
    }, 3000);
});

let signedIn = false;

socket.on('signInResponse', (data) => {
    console.log('signInResponse:', data);
    if (data && data.success) {
        signedIn = true;
        console.log('Signed in successfully as', data.username, 'isAdmin=', data.isAdmin);
        // Join the target room via joinRoom event (store in session)
        socket.emit('joinRoom', ROOM);
        setTimeout(() => runLightning(), 500);
    } else {
        console.log('Sign in failed; response:', data);
    }
});

function runLightning() {
    console.log('Requesting runSpeedTest for room', ROOM);
    socket.emit('runSpeedTest', { room: ROOM });
}

socket.on('systemMessage', (msg) => {
    console.log('SYSTEM:', msg);
});

socket.on('lightningTestProgress', (data) => {
    console.log('Progress:', data.round, '/', data.totalRounds, data.condition, data.incentive);
});

socket.on('lightningTestComplete', (data) => {
    console.log('LIGHTNING COMPLETE');
    if (data.csvData) {
        const fs = require('fs');
        const path = require('path');
        const filename = `experiment_results/lightning_full_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
        fs.writeFileSync(path.join(__dirname,'..',filename), data.csvData, 'utf8');
        console.log('Saved CSV to', filename);
    }
    console.log('Stats:', data.stats || data.message);
    socket.disconnect();
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('Connect error:', err.message);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
});
