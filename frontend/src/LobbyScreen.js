import React from 'react';
import { useNavigate } from 'react-router-dom';

function LobbyScreen() {
  const navigate = useNavigate();

  function handleCreateRoom() {
    // For demo, just navigate to a new room
    const roomId = Math.random().toString(36).substr(2, 6);
    navigate(`/room/${roomId}`);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Lobby</h1>
      <button onClick={handleCreateRoom}>Create Room</button>
      {/* Add room list/join logic here */}
    </div>
  );
}

export default LobbyScreen;
