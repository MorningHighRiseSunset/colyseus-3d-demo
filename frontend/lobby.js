const socket = io('https://colyseus-3d-demo.onrender.com');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomId = document.getElementById('joinRoomId');
const roomList = document.getElementById('roomList');

createRoomBtn.onclick = () => {
  socket.emit('createRoom');
};

joinRoomBtn.onclick = () => {
  const roomId = joinRoomId.value.trim();
  if (roomId) {
    window.location.href = `game.html?roomId=${roomId}`;
  }
};

socket.on('roomCreated', (roomId) => {
  alert(`Room created! Room ID: ${roomId}\nShare this ID with your friend to join.`);
  window.location.href = `game.html?roomId=${roomId}`;
});

socket.on('roomList', (rooms) => {
  roomList.innerHTML = '';
  rooms.forEach(roomId => {
    const div = document.createElement('div');
    div.innerHTML = `<span class="player-dot"></span>Room: ${roomId}`;
    const joinBtn = document.createElement('button');
    joinBtn.textContent = 'Join';
    joinBtn.className = 'btn';
    joinBtn.onclick = () => {
      window.location.href = `game.html?roomId=${roomId}`;
    };
    div.appendChild(joinBtn);
    roomList.appendChild(div);
  });
});

// Request room list every 5 seconds
setInterval(() => {
  socket.emit('getRooms');
}, 5000);
