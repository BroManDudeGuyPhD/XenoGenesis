const io = require('socket.io-client');

const SERVER = process.env.SERVER_URL || 'http://localhost:3000';

console.log('🔬 Reconnection test starting against', SERVER);

let socket = io(SERVER, {
  reconnectionAttempts: 3,
  timeout: 5000
});

socket.on('connect', () => {
  console.log('✅ Connected to server (id=' + socket.id + ')');

  // Ask server to restore session (server will reply with sessionRestored or sessionInvalid)
  socket.emit('requestSessionRestore', { room: 'TestRoom' });
});

socket.on('sessionRestored', (data) => {
  console.log('🟢 sessionRestored received:', data);
});

socket.on('sessionInvalid', (data) => {
  console.log('🔴 sessionInvalid received:', data);
});

socket.on('connect_error', (err) => {
  console.error('❌ connect_error', err.message || err);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 disconnected:', reason);
});

// After 2s, force a disconnect and then reconnect to simulate reconnect flow
setTimeout(() => {
  console.log('🔁 Simulating disconnect');
  socket.disconnect();

  setTimeout(() => {
    console.log('🔄 Reconnecting');
    socket.connect();
  }, 1500);
}, 2000);

// Wait a bit then exit
setTimeout(() => {
  console.log('✅ Reconnect test complete — exiting');
  socket.close();
  process.exit(0);
}, 8000);
