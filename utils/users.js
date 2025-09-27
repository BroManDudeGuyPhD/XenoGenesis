const users = [];

// Join user to chat
function userJoin(id, username, room) {
  // Remove user if they already exist (to handle room changes)
  const existingIndex = users.findIndex(user => user.id === id);
  if (existingIndex !== -1) {
    users.splice(existingIndex, 1);
  }
  
  // Also remove any user with the same username in the same room (for reconnection)
  const duplicateIndex = users.findIndex(user => user.username === username && user.room === room);
  if (duplicateIndex !== -1) {
    console.log(`🔄 Removing duplicate user ${username} from room ${room} during reconnection`);
    users.splice(duplicateIndex, 1);
  }
  
  const user = { id, username, room };
  users.push(user);
  
  return user;
}

// Get current user
function getCurrentUser(id) {
  return users.find(user => user.id === id);
}

// User leaves chat
function userLeave(id) {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

// Get room users
function getRoomUsers(room) {
  return users.filter(user => user.room === room);
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
};
