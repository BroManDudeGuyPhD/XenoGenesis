# XenoGenesis Modular System

## Overview

This document describes the new modular client architecture that enhances the legacy monolithic client.js system while maintaining full backward compatibility.

## Architecture

### Core Modules

#### 1. **main.js** - Application Coordinator
- Entry point for the modular system
- Initializes all modules in proper order
- Exposes legacy functions globally for backward compatibility
- Manages application lifecycle and error handling

#### 2. **socketManager.js** - Connection Management
- Centralized socket.io instance
- Connection state monitoring
- Automatic reconnection handling
- Connection event listeners

#### 3. **socketHandlers.js** - Event Routing
- Organized socket event handlers by functionality
- Routes events to appropriate modules
- Maintains separation of concerns

#### 4. **gameUI.js** - Game Interface
- Modern game initialization and state management
- Poker table rendering and updates
- Grid visualization with animations
- Player status tracking and AI decision display

#### 5. **authentication.js** - User Management
- Login/logout functionality
- Session management
- User state tracking

#### 6. **tokenSystem.js** - Economic System
- Token pool management
- Wallet displays
- Economic calculations

#### 7. **adminFunctions.js** - Administrative Tools
- Moderator controls
- Experiment management
- Lightning tests

## Key Features

### Enhanced Game Initialization
The modular system provides comprehensive game initialization that matches the legacy client.js:

```javascript
// Complete initialization includes:
- Player object creation in Player.list
- Game state management (gameActive, selfId)
- LED tracker initialization
- Visual reset and UI management
- Real-time update handling
```

### AI Decision Representation
AI decisions are now properly displayed through:
- Real-time poker table updates
- Player status indicators
- Visual feedback for choices and lock-ins
- Comprehensive game state synchronization

### Backward Compatibility
The system maintains full compatibility with legacy code:
- All legacy functions exposed globally
- Legacy Player.list and game state variables
- Original socket event handling preserved
- Seamless integration with existing systems

## Event Flow

### Game Start Sequence
1. **Start Experiment** → Server processes request
2. **gameStarted** → Initial game notification
3. **init** → Complete player data and game setup
4. **triadComplete** → Grid initialization with animations
5. **update** → Real-time player state updates

### AI Decision Flow
1. **AI Makes Decision** → Server processes AI logic
2. **playerStatusUpdate** → Status changes broadcast
3. **update** → Player data synchronized
4. **Poker Table Update** → Visual representation updated

## Module Integration

### Socket Handler Routing
```javascript
// Events are routed to appropriate modules:
socket.on('init', data => gameUI.handleGameInit(data));
socket.on('playerStatusUpdate', data => gameUI.handlePlayerStatusUpdate(data));
socket.on('update', data => gameUI.handleGameUpdate(data));
```

### Global Function Exposure
```javascript
// Legacy compatibility maintained:
window.gameActive = false;
window.Player = { list: {} };
window.resetGameVisuals = legacyFunction;
```

## Benefits

### For Developers
- **Modular Architecture**: Clean separation of concerns
- **Easy Maintenance**: Isolated functionality in focused modules
- **Enhanced Testing**: Individual modules can be tested independently
- **Better Documentation**: Clear module responsibilities

### For Users
- **Improved Reliability**: Better error handling and state management
- **Enhanced Visuals**: Smooth animations and real-time updates
- **Consistent Experience**: Unified interface across all features
- **Better Performance**: Optimized event handling and state updates

## Migration Notes

### From Legacy Client.js
- All existing functionality preserved
- New features automatically available
- No breaking changes to existing code
- Gradual migration path available

### Enhanced Features
- **Server Disconnect Handling**: Automatic redirect to login on server restart
- **Game Board Animations**: Visual feedback for experiment start
- **AI Decision Tracking**: Real-time display of AI choices
- **Comprehensive Initialization**: Complete game state setup

## Future Development

The modular system provides a foundation for:
- Additional game modes and experiments
- Enhanced UI components
- Better mobile responsiveness
- Advanced analytics and reporting
- Third-party integrations

## Technical Details

### Module Loading Order
1. Core utilities (utils.js)
2. Socket management (socketManager.js)
3. Authentication (authentication.js)
4. UI management (uiManager.js)
5. Game systems (gameUI.js, tokenSystem.js)
6. Administrative tools (adminFunctions.js)
7. Event handlers (socketHandlers.js)

### State Synchronization
- Global state variables synchronized between legacy and modular code
- Real-time updates propagated through all relevant modules
- Consistent state management across the entire application

## Troubleshooting

### Common Issues
- **Game Not Starting**: Check console for initialization errors
- **AI Not Displaying**: Verify Player.list is populated
- **Socket Disconnections**: Check network connectivity

### Debug Mode
Enable detailed logging with:
```javascript
window.DEBUG_MODE = true;
```

## Support

For technical issues or questions about the modular system, refer to the code comments and console logging for detailed debugging information.