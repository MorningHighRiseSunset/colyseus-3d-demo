const socket = io('https://colyseus-3d-demo-9yuv.onrender.com');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomId = document.getElementById('joinRoomId');
const roomList = document.getElementById('roomList');
const playerNameInput = document.getElementById('playerName');

createRoomBtn.onclick = () => {
  socket.emit('createRoom');
};

joinRoomBtn.onclick = () => {
  const roomId = joinRoomId.value.trim();
  const playerName = playerNameInput.value.trim() || 'Player';
  if (roomId) {
    window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
  }
};

socket.on('roomCreated', (roomId) => {
  const playerName = playerNameInput.value.trim() || 'Player';
  window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
});

// --- Enhanced Room List Rendering ---
socket.on('roomList', (rooms) => {
  roomList.innerHTML = '';
  rooms.forEach(room => {
    // room can be an object: { id, playerCount }
    let roomId, playerCount;
    if (typeof room === 'object') {
      roomId = room.id;
      playerCount = room.playerCount || 1;
    } else {
      roomId = room;
      playerCount = 1;
    }
    const div = document.createElement('div');
    div.className = 'room-entry';
    div.innerHTML = `
      <span class="player-dot"></span>
      <span class="room-id">Room: <b>${roomId}</b></span>
      <span class="player-count">Players: ${playerCount}</span>
    `;
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Join';
    joinBtn.className = 'btn';
    joinBtn.onclick = () => {
      const playerName = playerNameInput.value.trim() || 'Player';
      window.location.href = `game.html?roomId=${roomId}&playerName=${encodeURIComponent(playerName)}`;
    };
    div.appendChild(joinBtn);
    roomList.appendChild(div);
  });
});

// --- Add Refresh Button ---
const refreshBtn = document.createElement('button');
refreshBtn.textContent = 'Refresh Rooms';
refreshBtn.className = 'btn';
refreshBtn.style.marginBottom = '12px';
refreshBtn.onclick = () => {
  socket.emit('getRooms');
};
roomList.parentNode.insertBefore(refreshBtn, roomList);

// Request room list every 5 seconds
setInterval(() => {
  socket.emit('getRooms');
}, 5000);
