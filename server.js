const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Chess } = require('chess.js');
const bodyParser = require('body-parser');

// Set up enhanced logging
const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLogLevel = process.env.LOG_LEVEL ? 
  logLevels[process.env.LOG_LEVEL.toUpperCase()] : 
  logLevels.INFO;

// Logger function
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  
  if (logLevels[level] <= currentLogLevel) {
    const logMessage = data ? 
      `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)}` : 
      `[${timestamp}] [${level}] ${message}`;
    
    if (level === 'ERROR') {
      console.error(logMessage);
    } else if (level === 'WARN') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
  }
}

// Log server startup
log('INFO', 'Starting Chessville server...');

// Import our game configuration system
const gameConfig = require('./gameConfig');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Global variables
const gameRooms = {};
const disconnectedPlayers = {}; // Store information about disconnected players
const PLAYER_RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

// Admin panel routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Config API endpoints
app.get('/api/config', (req, res) => {
  const configData = gameConfig.getConfig();
  res.json({
    success: true,
    config: configData.config,
    version: configData.version
  });
});

app.post('/api/config', (req, res) => {
  try {
    const updates = req.body;
    const updatedConfig = gameConfig.updateConfig(updates);
    
    // Broadcast config update to all rooms
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      room.gameState.config = updatedConfig.config;
      
      // Notify clients of the config update
      io.to(roomId).emit('configUpdate', {
        config: updatedConfig.config,
        version: updatedConfig.version
      });
    }
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      version: updatedConfig.version
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration: ' + error.message
    });
  }
});

app.post('/api/config/reset', (req, res) => {
  try {
    // Reset to default config by reinitializing the module
    delete require.cache[require.resolve('./gameConfig')];
    const freshConfig = require('./gameConfig');
    const configData = freshConfig.getConfig();
    
    // Update reference
    gameConfig = freshConfig;
    
    // Broadcast config reset to all rooms
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      room.gameState.config = configData.config;
      
      // Notify clients of the config update
      io.to(roomId).emit('configUpdate', {
        config: configData.config,
        version: configData.version
      });
    }
    
    res.json({
      success: true,
      message: 'Configuration reset to defaults',
      version: configData.version
    });
  } catch (error) {
    console.error('Error resetting configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset configuration: ' + error.message
    });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  log('INFO', 'New client connected:', socket.id);
  
  // Handle joining a game
  socket.on('joinGame', (data) => {
    try {
      const { username, roomId, isReconnecting, previousColor, savedFEN, savedFarmState } = data;
      let gameRoomId = roomId;
      
      log('INFO', `🔴 Join game request received: Room=${roomId}, Username=${username}, Reconnecting=${isReconnecting}, PreviousColor=${previousColor}, HasSavedFEN=${!!savedFEN}, HasSavedFarmState=${!!savedFarmState}`);
      
      // If no room ID is provided, create a new one
      if (!gameRoomId) {
        gameRoomId = uuidv4().substring(0, 8);
        log('INFO', `Creating new game room: ${gameRoomId}`);
        
        // Initialize the new game room with more complete game state
        gameRooms[gameRoomId] = {
          id: gameRoomId,
          players: {},
          playerCount: 0,
          gameState: {
            chessEngineState: new Chess().fen(),
            isGameOver: false,
            winner: null,
            farmState: {}, // Store farm state for each player
            wheatCounts: {} // Store wheat counts for each player
          },
          currentTurn: 'white',
          disconnectedPlayers: {}, // Track disconnected players in this room
          createdAt: Date.now()
        };
      }
      
      // Check if the room exists - if not, create it (useful for rejoining specific rooms)
      if (!gameRooms[gameRoomId]) {
        log('INFO', `Creating new game room with specified ID: ${gameRoomId}`);
        gameRooms[gameRoomId] = {
          id: gameRoomId,
          players: {},
          playerCount: 0,
          gameState: {
            chessEngineState: new Chess().fen(),
            isGameOver: false,
            winner: null,
            farmState: {}, // Store farm state for each player
            wheatCounts: {} // Store wheat counts for each player
          },
          currentTurn: 'white',
          disconnectedPlayers: {}, // Track disconnected players in this room
          createdAt: Date.now()
        };
      }
      
      // Get the game room
      const gameRoom = gameRooms[gameRoomId];
      
      // RECONNECTION HANDLING: Check for disconnected players
      if (isReconnecting && previousColor) {
        log('INFO', `🔴 Processing reconnection request for ${previousColor} player in room ${gameRoomId}`);
        
        // Try to find the disconnected player with this color
        const disconnectedPlayerId = Object.keys(gameRoom.disconnectedPlayers).find(
          id => gameRoom.disconnectedPlayers[id].color === previousColor
        );
        
        if (disconnectedPlayerId) {
          log('INFO', `🔴 Found disconnected player: ${disconnectedPlayerId}`);
          
          // Get the disconnected player data
          const disconnectedPlayer = gameRoom.disconnectedPlayers[disconnectedPlayerId];
          
          // If we have saved game state from the client, use it
          if (savedFEN && gameRoom.gameState) {
            log('INFO', `🔴 Using client-provided FEN for reconnection: ${savedFEN}`);
            
            // Try to validate the FEN before using it
            try {
              const chessTester = new Chess();
              if (chessTester.load(savedFEN)) {
                gameRoom.gameState.chessEngineState = savedFEN;
                log('INFO', `🔴 Successfully restored chess state from client FEN`);
              } else {
                log('WARN', `🔴 Invalid FEN position from client, using server state`);
              }
            } catch (e) {
              log('ERROR', `🔴 Error validating client FEN position: ${e.message}`);
            }
          }
          
          // If we have saved farm state, use it
          if (savedFarmState && gameRoom.gameState) {
            log('INFO', `🔴 Using client-provided farm state for reconnection`);
            gameRoom.gameState.farmState = {
              ...gameRoom.gameState.farmState,
              ...savedFarmState
            };
            log('INFO', `🔴 Successfully restored farm state from client`);
          }
          
          // Add player to the room with their previous color
          gameRoom.players[socket.id] = {
            id: socket.id,
            username: username || disconnectedPlayer.username || 'Player',
            color: disconnectedPlayer.color,
            wheatCount: disconnectedPlayer.wheatCount || 100,
            farmState: disconnectedPlayer.farmState || []
          };
          
          // Remove from disconnected players
          delete gameRoom.disconnectedPlayers[disconnectedPlayerId];
          
          // Join the Socket.io room
          socket.join(gameRoomId);
          
          // Notify player they've successfully reconnected
          socket.emit('reconnectSuccess', {
            roomId: gameRoomId,
            color: disconnectedPlayer.color,
            wheatCount: disconnectedPlayer.wheatCount || 100,
            farmState: savedFarmState || gameRoom.gameState.farmState,
            currentTurn: gameRoom.currentTurn,
            gameState: {
              chessEngineState: gameRoom.gameState.chessEngineState
            },
            savedFEN: savedFEN
          });
          
          // If it's their turn, notify them
          if (gameRoom.currentTurn === disconnectedPlayer.color) {
            log('INFO', `🔴 Notifying reconnected player it's their turn`);
            socket.emit('your-turn', {
              color: disconnectedPlayer.color
            });
          }
          
          // Notify opponent that player has reconnected
          for (const playerId in gameRoom.players) {
            if (playerId !== socket.id) {
              io.to(playerId).emit('opponent-reconnected', {
                username: username || disconnectedPlayer.username || 'Player'
              });
            }
          }
          
          log('INFO', `🔴 Player ${socket.id} successfully reconnected to room ${gameRoomId} as ${disconnectedPlayer.color}`);
          return;
        } else {
          log('WARN', `🔴 Disconnected player with color ${previousColor} not found in room ${gameRoomId}`);
        }
      }
      
      // If we got here, either it's not a reconnection attempt or the reconnection failed
      log('INFO', `🔴 Regular join or failed reconnection for room ${gameRoomId}`);
      
      // Check if the room is full
      if (Object.keys(gameRooms[gameRoomId].players).length >= 2) {
        // If someone tries to reconnect but didn't provide correct info, reject
        log('WARN', `Room ${gameRoomId} is full`);
        socket.emit('roomFull', { roomId: gameRoomId });
        return;
      }
      
      // FIXED: Improved player color assignment logic to handle reconnection failures better
      // Instead of simply using playerCount, we check which color is already taken
      
      // Check if there's already a player in the room and get their color
      let takenColor = null;
      for (const pid in gameRooms[gameRoomId].players) {
        takenColor = gameRooms[gameRoomId].players[pid].color;
        break; // Just need one player's color
      }
      
      // If one player is already in the room, assign the opposite color
      if (takenColor) {
        playerColor = takenColor === 'white' ? 'black' : 'white';
        log('INFO', `🔴 Room has a ${takenColor} player, assigning ${playerColor} to reconnecting player`);
        
        // If the reconnecting player specified a color and it's already taken, warn them
        if (previousColor && previousColor === takenColor) {
          log('WARN', `🔴 Requested color ${previousColor} is already taken, assigning ${playerColor} instead`);
        }
      } else {
        // No players in room, default to white for first player
        playerColor = 'white';
        log('INFO', `🔴 No players in room, assigning white to first player`);
      }
      
      const isFirstPlayer = playerColor === 'white';
      
      log('INFO', `🔴 Assigning player ${socket.id} to ${playerColor} in room ${gameRoomId}`);
      
      // Add player to the room
      gameRooms[gameRoomId].players[socket.id] = {
        id: socket.id,
        username: username || 'Player',
        color: playerColor,
        wheatCount: 100, // Default value
        farmState: [] // Default value
      };
      
      // Increment player count
      gameRooms[gameRoomId].playerCount++;
      
      // Join the Socket.io room
      socket.join(gameRoomId);
      
      log('INFO', `Player ${socket.id} joined room ${gameRoomId} as ${playerColor}`);
      
      // Notify player they've been assigned to a room
      socket.emit('playerAssigned', {
        roomId: gameRoomId,
        color: playerColor,
        isFirstPlayer: isFirstPlayer,
        username: username
      });
      
      // If this is the second player, notify both players the game can start
      if (gameRooms[gameRoomId].playerCount === 2) {
        log('INFO', `Game starting in room ${gameRoomId}`);
        
        // Notify all players in the room
        io.to(gameRoomId).emit('gameStart', {
          roomId: gameRoomId,
          startingTurn: 'white'
        });
        
        // Notify white player it's their turn
        const whitePlayerId = Object.keys(gameRooms[gameRoomId].players).find(
          id => gameRooms[gameRoomId].players[id].color === 'white'
        );
        
        if (whitePlayerId) {
          io.to(whitePlayerId).emit('your-turn', {
            color: 'white'
          });
        }
      } else {
        log('INFO', `Waiting for another player to join room ${gameRoomId}`);
      }
    } catch (error) {
      log('ERROR', 'Error joining game:', error);
      socket.emit('error', { message: 'Error joining game' });
    }
  });
  
  // Handle chess moves
  socket.on('chess-move', (data) => {
    try {
      const { roomId, move, fen } = data;
      
      // Validate the room exists
      if (!gameRooms[roomId]) {
        log('WARN', `Move attempted in non-existent room: ${roomId}`);
        socket.emit('error', { message: 'Game room not found' });
        return;
      }
      
      // Get the player from this socket
      const player = gameRooms[roomId].players[socket.id];
      if (!player) {
        log('WARN', `Player not found in room ${roomId}`);
        socket.emit('error', { message: 'Player not found in this game' });
        return;
      }
      
      // Check if it's this player's turn
      if (player.color !== gameRooms[roomId].currentTurn) {
        log('WARN', `Move attempted out of turn by ${player.color}`);
        socket.emit('error', { message: 'Not your turn' });
        return;
      }
      
      // Update the chess engine state
      gameRooms[roomId].gameState.chessEngineState = fen;
      
      // Switch turns
      gameRooms[roomId].currentTurn = player.color === 'white' ? 'black' : 'white';
      
      log('INFO', `Valid move by ${player.color} in room ${roomId}`);
      
      // Broadcast the move to the opponent
      socket.to(roomId).emit('chess-move', {
        move: move,
        fen: fen
      });
      
      // Notify the next player it's their turn
      const nextPlayerId = Object.keys(gameRooms[roomId].players).find(
        id => gameRooms[roomId].players[id].color === gameRooms[roomId].currentTurn
      );
      
      if (nextPlayerId) {
        io.to(nextPlayerId).emit('your-turn', {
          color: gameRooms[roomId].currentTurn
        });
      }
    } catch (error) {
      log('ERROR', 'Error handling chess-move:', error);
      socket.emit('error', { message: 'Failed to process move' });
    }
  });
  
  // Handle game over
  socket.on('game-over', (data) => {
    try {
      const { roomId, winner, reason } = data;
      
      // Validate the room exists
      if (!gameRooms[roomId]) {
        log('WARN', `Game over notification for non-existent room: ${roomId}`);
        return;
      }
      
      log('INFO', `Game over in room ${roomId}. Winner: ${winner}, Reason: ${reason}`);
      
      // Update game state
      gameRooms[roomId].gameState.isGameOver = true;
      gameRooms[roomId].gameState.winner = winner;
      
      // Broadcast to all players in the room
      io.to(roomId).emit('game-over', {
        winner: winner,
        reason: reason
      });
    } catch (error) {
      log('ERROR', 'Error handling game-over:', error);
    }
  });
  
  // Add handler for farm state updates
  socket.on('farm-update', (data) => {
    try {
      const { roomId, farmState, wheatCount } = data;
      
      // Validate the room exists
      if (!gameRooms[roomId]) {
        log('WARN', `Farm update attempted in non-existent room: ${roomId}`);
        socket.emit('error', { message: 'Game room not found' });
        return;
      }
      
      // Get the player from this socket
      const player = gameRooms[roomId].players[socket.id];
      if (!player) {
        log('WARN', `Player not found in room ${roomId}`);
        socket.emit('error', { message: 'Player not found in this game' });
        return;
      }
      
      // Store the farm state and wheat count for this player
      player.farmState = farmState;
      player.wheatCount = wheatCount;
      
      // Also store in the gameState for persistence
      if (!gameRooms[roomId].gameState.farmState) {
        gameRooms[roomId].gameState.farmState = {};
      }
      if (!gameRooms[roomId].gameState.wheatCounts) {
        gameRooms[roomId].gameState.wheatCounts = {};
      }
      
      gameRooms[roomId].gameState.farmState[player.color] = farmState;
      gameRooms[roomId].gameState.wheatCounts[player.color] = wheatCount;
      
      log('INFO', `Farm state updated for player ${player.color} in room ${roomId}`);
    } catch (error) {
      log('ERROR', 'Error handling farm-update:', error);
      socket.emit('error', { message: 'Failed to update farm state' });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    log('INFO', 'Client disconnected:', socket.id);
    
    // Find any game rooms this player is in
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      if (room.players[socket.id]) {
        const playerInfo = room.players[socket.id];
        const color = playerInfo.color;
        
        log('INFO', `Player ${socket.id} (${color}) left room ${roomId}`);
        
        // Store more complete player state for reconnection
        room.disconnectedPlayers[color] = {
          username: playerInfo.username,
          timestamp: Date.now(),
          timeToLive: PLAYER_RECONNECT_TIMEOUT,
          wheatCount: playerInfo.wheatCount || 100,
          farmState: playerInfo.farmState || [],
          // Store any other player state we need to restore
        };
        
        log('INFO', `Added ${color} player to disconnectedPlayers list for room ${roomId}`);
        
        // Remove the player from active players
        delete room.players[socket.id];
        room.playerCount--;
        
        // Notify other players in the room
        socket.to(roomId).emit('opponent-disconnected', { color: color });
        
        // Set a timer to clean up if the player doesn't reconnect
        setTimeout(() => {
          if (room.disconnectedPlayers && room.disconnectedPlayers[color]) {
            log('INFO', `Cleanup: Player ${color} did not reconnect to room ${roomId} within timeout period`);
            delete room.disconnectedPlayers[color];
            
            // If both players are gone (one disconnected, one timed out), clean up the room
            if (room.playerCount === 0 && Object.keys(room.disconnectedPlayers).length === 0) {
              log('INFO', `Deleting empty room ${roomId}`);
              delete gameRooms[roomId];
            }
          }
        }, PLAYER_RECONNECT_TIMEOUT);
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  log('INFO', `Server running on port ${PORT}`);
  log('INFO', `Open http://localhost:${PORT} in your browser to play`);
}); 