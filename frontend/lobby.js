const client = new Colyseus.Client('http://localhost:3001'); // Change to your backend URL when deployed
const createRoomBtn = document.getElementById('createRoomBtn');
const roomList = document.getElementById('roomList');

createRoomBtn.onclick = async () => {
  const room = await client.create('game');
  window.location.href = `room.html?roomId=${room.id}`;
};

// TODO: Fetch and display available rooms
