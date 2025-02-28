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

// Game rooms storage
const gameRooms = {};

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
      const { username, roomId } = data;
      let gameRoomId = roomId;
      
      // If no room ID is provided, create a new one
      if (!gameRoomId) {
        gameRoomId = uuidv4().substring(0, 8);
        log('INFO', `Creating new game room: ${gameRoomId}`);
        
        // Initialize the new game room
        gameRooms[gameRoomId] = {
          id: gameRoomId,
        players: {},
          playerCount: 0,
          gameState: {
            chessEngineState: new Chess().fen(),
            isGameOver: false,
            winner: null
          },
        currentTurn: 'white'
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
            winner: null
          },
          currentTurn: 'white'
        };
      }
      
      // Check if the room is full
      if (Object.keys(gameRooms[gameRoomId].players).length >= 2) {
        log('WARN', `Room ${gameRoomId} is full`);
        socket.emit('roomFull', { roomId: gameRoomId });
        return;
      }
      
      // Determine player color (first player is white, second is black)
      const playerColor = gameRooms[gameRoomId].playerCount === 0 ? 'white' : 'black';
      const isFirstPlayer = playerColor === 'white';
      
      // Add player to the room
      gameRooms[gameRoomId].players[socket.id] = {
        id: socket.id,
        username: username || 'Player',
        color: playerColor
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
        // Notify the player they're waiting for an opponent
        socket.emit('waitingForOpponent', {
          roomId: gameRoomId
        });
      }
    } catch (error) {
      log('ERROR', 'Error handling joinGame:', error);
      socket.emit('error', { message: 'Failed to join game' });
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
  
  // Handle disconnection
  socket.on('disconnect', () => {
    log('INFO', 'Client disconnected:', socket.id);
    
    // Find any game rooms this player is in
    for (const roomId in gameRooms) {
      if (gameRooms[roomId].players[socket.id]) {
        const color = gameRooms[roomId].players[socket.id].color;
        
        log('INFO', `Player ${socket.id} (${color}) left room ${roomId}`);
        
        // Remove the player
        delete gameRooms[roomId].players[socket.id];
        gameRooms[roomId].playerCount--;
        
        // Notify other players in the room
        socket.to(roomId).emit('opponent-disconnected');
        
        // If no players remain, clean up the room
        if (gameRooms[roomId].playerCount === 0) {
          log('INFO', `Deleting empty room ${roomId}`);
          delete gameRooms[roomId];
        }
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