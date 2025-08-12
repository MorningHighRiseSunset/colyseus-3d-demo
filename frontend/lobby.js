const client = new Colyseus.Client('https://colyseus-3d-demo.onrender.com');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomList = document.getElementById('roomList');

createRoomBtn.onclick = async () => {
  const room = await client.create('game');
  window.location.href = `room.html?roomId=${room.id}`;
};

// TODO: Fetch and display available rooms
