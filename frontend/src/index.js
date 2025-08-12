import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LobbyScreen from './LobbyScreen';
import RoomScreen from './RoomScreen';
import GameScreen from './GameScreen';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LobbyScreen />} />
      <Route path="/room/:roomId" element={<RoomScreen />} />
      <Route path="/game/:roomId" element={<GameScreen />} />
    </Routes>
  </BrowserRouter>
);
