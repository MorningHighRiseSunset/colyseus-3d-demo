const colyseus = require('colyseus');

class GameRoom extends colyseus.Room {
  onCreate(options) {
    this.setMetadata({ type: 'game' });
    this.state = {
      cubePosition: { x: 0, y: 0, z: 0 }
    };
    this.onMessage('cubeMoved', (client, pos) => {
      this.state.cubePosition = pos;
      this.broadcast('cubeMoved', pos);
    });
  }

  onJoin(client, options) {
    // Optionally notify others
  }

  onLeave(client, consented) {
    // Optionally notify others
  }

  onDispose() {
    // Cleanup if needed
  }
}

module.exports = { GameRoom };
