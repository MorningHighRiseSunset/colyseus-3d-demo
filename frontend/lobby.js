document.addEventListener('DOMContentLoaded', function() {
  const client = new Colyseus.Client('https://colyseus-3d-demo.onrender.com');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const roomList = document.getElementById('roomList');

  createRoomBtn.onclick = async () => {
    const room = await client.create('game');
    window.location.href = `room.html?roomId=${room.id}`;
  };

  // Fetch and display available rooms
  async function fetchRooms() {
    try {
      const rooms = await client.getAvailableRooms('game');
      roomList.innerHTML = '';
      if (rooms.length === 0) {
        roomList.innerHTML = '<div>No rooms available. Create one!</div>';
      } else {
        rooms.forEach(r => {
          const div = document.createElement('div');
          div.textContent = `Room: ${r.roomId} | Players: ${r.clients}/${r.maxClients || '?'}`;
          const joinBtn = document.createElement('button');
          joinBtn.textContent = 'Join Room';
          joinBtn.className = 'btn';
          joinBtn.onclick = () => {
            window.location.href = `room.html?roomId=${r.roomId}`;
          };
          div.appendChild(joinBtn);
          roomList.appendChild(div);
        });
      }
    } catch (err) {
      roomList.innerHTML = '<div>Error loading rooms.</div>';
    }
  }

  fetchRooms();
  // Optionally refresh room list every 5 seconds
  setInterval(fetchRooms, 5000);
});
