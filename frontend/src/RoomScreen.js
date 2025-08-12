import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

function RoomScreen() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  function handleStartGame() {
    navigate(`/game/${roomId}`);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Room: {roomId}</h1>
      <button onClick={handleStartGame}>Start Game</button>
      {/* Add player list/waiting logic here */}
    </div>
  );
}

export default RoomScreen;
