# Video Chat System Implementation

## Overview
This document describes the comprehensive video chat system implemented for the Vegas Metropoly game. The system provides real-time video communication between players with full control over camera, microphone, and chat window management. **The system now dynamically creates video boxes based on the number of players in the game.**

## Features

### Main Toggle Button
- **Location**: Fixed position in top-right corner
- **Function**: Start/Stop entire video chat session
- **Visual States**:
  - 📹 (Green): Video chat OFF
  - 🔴 (Red with pulse animation): Video chat ON
- **Behavior**: 
  - When OFF: Creates new video chat instance, shows video container
  - When ON: Calls cleanup function, hides container, resets button

### Video Chat Window
- **Position**: Top-right corner, below toggle button
- **Size**: 320px width (responsive on mobile)
- **Features**: Minimizable, draggable, **dynamically adjusts to player count**

### Dynamic Video Grid System
- **2 Players**: 2 video boxes side by side
- **3-4 Players**: 2x2 grid layout
- **5-6 Players**: 3x2 grid layout  
- **7-8 Players**: 4x2 grid layout
- **Responsive**: Stacks vertically on mobile devices
- **Auto-update**: Adjusts when players are added/removed during game setup

### Control Buttons

#### 1. Toggle Video Button (🔴/📹)
- **Function**: Turn camera on/off
- **Implementation**: 
  ```javascript
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  ```
- **Visual Feedback**: 
  - 🔴 (Green): Video ON
  - 📹 (Grey): Video OFF

#### 2. Toggle Audio Button (🔊/🔇)
- **Function**: Mute/unmute microphone
- **Implementation**:
  ```javascript
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  ```
- **Visual Feedback**:
  - 🔊 (Green): Audio ON
  - 🔇 (Grey): Audio OFF

#### 3. Leave Button (❌)
- **Function**: Exit video chat completely
- **Implementation**: Stops all tracks, closes connections, hides window
- **Style**: Red background (danger class)

#### 4. Minimize Button (−/+)
- **Function**: Collapse/expand video chat window
- **Implementation**: Toggles CSS class, changes button text
- **Visual Feedback**:
  - −: Minimize
  - +: Expand

### Always Show All Video Positions
- **Local Video**: Always displays user's camera feed (Player 1)
- **Remote Videos**: Shows placeholders when opponents are offline
- **Placeholder Content**: 
  - 👤 icon
  - "Player X" or "Waiting for opponent..." message
- **Behavior**: 
  - Creates placeholders for all players when video chat starts
  - Replaces placeholders when real video arrives
  - Recreates placeholders when players leave
  - **Dynamically adjusts grid layout based on player count**

## Technical Implementation

### State Management
```javascript
let videoChat = null;
let localStream = null;
let peerConnection = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let isMinimized = false;
let videoChatActive = false;
let videoBoxes = []; // Array to store all video boxes
let currentPlayerCount = 0; // Track current number of players
```

### Dynamic Video Box Creation
```javascript
function createVideoBox(playerIndex, playerName, isLocal = false) {
    // Creates video box with video element, placeholder, and label
    // Returns complete video box DOM element
}

function updateVideoGridLayout(playerCount) {
    // Clears existing video boxes
    // Adds appropriate CSS grid class (grid-2, grid-3, etc.)
    // Creates video boxes for each player
    // Updates currentPlayerCount
}
```

### Key Functions

#### `initVideoChat()`
- Gets DOM elements
- Sets up event listeners
- Initializes video chat system

#### `toggleVideoChat()`
- Main toggle function
- Starts or stops video chat based on current state

#### `startVideoChat()`
- **Determines player count from game state**
- **Updates video grid layout based on player count**
- Requests camera/microphone permissions
- Creates local video stream
- Shows video chat container
- Updates UI states

#### `stopVideoChat()`
- Stops all media tracks
- Closes peer connections
- **Hides all videos and shows placeholders**
- Resets all states

#### `updateVideoChatForGameState()`
- **NEW**: Updates video chat when game state changes
- **Called when players are added/removed**
- **Recreates video grid layout**
- **Re-establishes local video stream**

#### `toggleVideo()` / `toggleAudio()`
- Toggles individual media tracks
- Updates button states and icons
- Provides visual feedback

### Game Integration
The video chat system is now fully integrated with the game's player management:

- **Player Selection**: Updates when tokens are selected
- **AI Toggle**: Updates when AI players are added/removed
- **Game Start**: Updates when game finalizes player selection
- **Real-time**: Automatically adjusts to player count changes

### Error Handling
- **Permission Denied**: Shows "Camera/microphone access denied"
- **No Device**: Shows "No camera/microphone found"
- **Device Busy**: Shows "Camera/microphone is busy"
- **Not Supported**: Shows "Camera/microphone not supported"

### Visual Feedback System
- **Status Messages**:
  - "Connecting..." when joining
  - "Waiting for X opponent(s)..." when alone
  - "X/Y players connected" when video is working
  - "Participant left" when someone disconnects
- **Button States**: Color changes and icon updates
- **Animations**: Smooth transitions and pulse effects

## CSS Styling

### Key Classes
- `.video-chat-toggle-btn`: Main toggle button
- `.video-chat-container`: Main video chat window
- `.video-control-btn`: Control buttons (video, audio, leave, minimize)
- `.video-box`: Individual video containers
- `.video-placeholder`: Placeholder for offline users

### Dynamic Grid Classes
- `.video-grid.grid-2`: 2 players (1x2)
- `.video-grid.grid-3`: 3 players (2x2)
- `.video-grid.grid-4`: 4 players (2x2)
- `.video-grid.grid-5`: 5 players (3x2)
- `.video-grid.grid-6`: 6 players (3x2)
- `.video-grid.grid-7`: 7 players (4x2)
- `.video-grid.grid-8`: 8 players (4x2)

### Responsive Design
- **Desktop**: Dynamic width based on player count
- **Tablet**: 280px width, stacked videos
- **Mobile**: Full width, side-by-side videos

### Animations
- **Slide In**: Video container slides in from right
- **Pulse**: Active toggle button pulses
- **Hover Effects**: Buttons scale and change color
- **Transitions**: Smooth state changes

## Usage

### Basic Usage
1. Click the 📹 button in the top-right corner
2. Grant camera/microphone permissions
3. **Video grid automatically adjusts to player count**
4. Use control buttons to manage video/audio
5. Click ❌ to leave video chat

### Advanced Features
- **Minimize**: Click − to collapse window
- **Toggle Video**: Click 🔴/📹 to turn camera on/off
- **Toggle Audio**: Click 🔊/🔇 to mute/unmute
- **Always Visible**: All video positions always shown
- **Dynamic Layout**: Automatically adjusts to player count

### Multi-Player Scenarios
- **2 Players**: Side-by-side video layout
- **3-4 Players**: 2x2 grid with placeholders
- **5-6 Players**: 3x2 grid with placeholders
- **7-8 Players**: 4x2 grid with placeholders
- **Real-time Updates**: Layout changes when players join/leave

## Browser Compatibility
- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile Browsers**: Responsive design support

## Security Considerations
- **HTTPS Required**: Video chat only works on secure connections
- **Permission Based**: Requires explicit user consent
- **Local Processing**: Video streams processed locally
- **No Recording**: No video/audio recording functionality

## Future Enhancements
- **WebRTC Integration**: Real peer-to-peer connections
- **Screen Sharing**: Share game board or screen
- **Chat Messages**: Text chat functionality
- **Multiple Participants**: Support for more than 8 players
- **Recording**: Optional video/audio recording
- **Background Blur**: Virtual background effects
- **Player Identification**: Show player names/tokens in video labels

## Troubleshooting

### Common Issues
1. **Camera not working**: Check browser permissions
2. **No audio**: Ensure microphone is enabled
3. **Video not showing**: Refresh page and try again
4. **Button not responding**: Check console for errors
5. **Wrong number of video boxes**: Check player count in game

### Debug Information
- All video chat events are logged to console
- Error messages displayed in video status area
- Network status shown in real-time
- Player count tracking in console

## Integration Notes
- **Game Integration**: Video chat runs independently of game logic
- **Performance**: Minimal impact on game performance
- **Memory Management**: Proper cleanup of media streams
- **Event Handling**: Non-intrusive to existing game events
- **Player Management**: Automatically syncs with game player state
- **Dynamic Updates**: Real-time adjustment to player count changes 