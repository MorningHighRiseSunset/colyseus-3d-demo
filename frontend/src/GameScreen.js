import React from 'react';
import App from './App';
import { useParams } from 'react-router-dom';

function GameScreen() {
  const { roomId } = useParams();
  // Pass roomId to App if needed for Colyseus
  return <App roomId={roomId} />;
}

export default GameScreen;
