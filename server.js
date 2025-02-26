const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const Chess = require('chess.js').Chess;
const bodyParser = require('body-parser');

// Import our game configuration system
const gameConfig = require('./gameConfig');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static(__dirname));
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
  console.log('New client connected:', socket.id);
  
  // Handle player joining a game
  socket.on('joinGame', (data) => {
    // Extract room ID from data object
    let roomId = data.roomId;
    
    // Generate a random room ID if none provided
    if (!roomId) {
      roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    console.log(`Player ${socket.id} joining room ${roomId}`);
    
    // Create room if it doesn't exist
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = {
        id: roomId,
        players: {},
        gameState: initializeGameState(),
        currentTurn: 'white'
      };
      console.log(`Created new room ${roomId} with current turn: white`);
    }
    
    const room = gameRooms[roomId];
    
    // Check if room is full
    if (Object.keys(room.players).length >= 2) {
      socket.emit('roomFull');
      return;
    }
    
    // Join the room
    socket.join(roomId);
    
    // Assign player color
    const isFirstPlayer = Object.keys(room.players).length === 0;
    const color = isFirstPlayer ? 'white' : 'black';
    
    // Add player to room
    room.players[socket.id] = {
      id: socket.id,
      color: color
    };
    
    console.log(`Player ${socket.id} assigned color ${color} in room ${roomId}`);
    
    // Notify player of assignment
    socket.emit('playerAssigned', {
      playerId: socket.id,
      color: color,
      roomId: roomId,
      isFirstPlayer: isFirstPlayer
    });
    
    // If room is now full, start the game
    if (Object.keys(room.players).length === 2) {
      console.log(`Room ${roomId} is full, starting game`);
      
      // Call our new function instead of directly emitting
      sendGameStart(room);
    }
  });
  
  // Handle game actions
  socket.on('gameAction', (data) => {
    // Find the room this player is in
    let playerRoom = null;
    let playerId = socket.id;
    
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      if (room.players[playerId]) {
        playerRoom = room;
        break;
      }
    }
    
    if (!playerRoom) {
      console.log(`Player ${playerId} not found in any room`);
      return;
    }
    
    console.log(`Received game action from ${playerId}: ${data.type}`);
    
    // Process the action based on type
    switch (data.type) {
      case 'movePiece':
        // Update chess engine state
        playerRoom.gameState.chessEngineState = data.chessEngineState;
        
        // Update player's corn count
        const playerColorMove = playerRoom.players[playerId].color;
        const playerKeyMove = playerColorMove === 'white' ? 'player1' : 'player2';
        playerRoom.gameState.farms[playerKeyMove].corn = data.newCorn;
        
        console.log(`Player ${playerId} moved a piece. New corn: ${data.newCorn}`);
        
        // Check if it was a capture
        if (data.isCapture) {
          playerRoom.gameState.farms[playerKeyMove].totalCaptures++;
          
          // Check if any capture-locked plots should be unlocked
          const totalCaptures = playerRoom.gameState.farms[playerKeyMove].totalCaptures;
          
          for (const req of playerRoom.gameState.farms[playerKeyMove].captureRequired) {
            if (req.capturesNeeded <= totalCaptures && !req.unlocked) {
              // Unlock this plot
              const plotIndex = req.plot;
              playerRoom.gameState.farms[playerKeyMove].plots[plotIndex].state = 'empty';
              req.unlocked = true;
              
              console.log(`Unlocked capture-locked plot ${plotIndex} for player ${playerId}`);
              break;
            }
          }
        }
        break;
        
      case 'farmAction':
        // Process farm action
        const action = data.farmAction;
        const plotIndex = data.plotIndex;
        const playerColorFarm = playerRoom.players[playerId].color;
        const playerKeyFarm = playerColorFarm === 'white' ? 'player1' : 'player2';
        
        // Update chess engine state
        if (data.chessEngineState) {
          playerRoom.gameState.chessEngineState = data.chessEngineState;
        }
        
        if (action === 'plant') {
          const plantType = data.plantType || 'corn';
          
          // Get the plant configuration
          const plant = playerRoom.gameState.config.farming.plants[plantType];
          const seedCost = plant.seedCost;
          const growthTime = plant.growthTime;
          
          // Plant in the selected plot
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].state = 'planted';
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].plantType = plantType;
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].growthStage = 1;
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].turnsToHarvest = growthTime;
          
          // Deduct seed cost
          playerRoom.gameState.farms[playerKeyFarm].corn -= seedCost;
          
          console.log(`Player ${playerId} planted ${plantType} in plot ${plotIndex}. New corn: ${playerRoom.gameState.farms[playerKeyFarm].corn}`);
        } else if (action === 'harvest') {
          const plantType = playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].plantType || 'corn';
          
          // Get the plant configuration
          const plant = playerRoom.gameState.config.farming.plants[plantType];
          const harvestYield = plant.harvestYield;
          
          // Harvest from the selected plot
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].state = 'empty';
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].plantType = null;
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].growthStage = 0;
          
          // Add harvest yield to player's corn
          playerRoom.gameState.farms[playerKeyFarm].corn += harvestYield;
          
          console.log(`Player ${playerId} harvested ${plantType} from plot ${plotIndex}. New corn: ${playerRoom.gameState.farms[playerKeyFarm].corn}`);
          
          // Check for victory condition
          const cornVictoryAmount = playerRoom.gameState.config.cornVictoryAmount;
          if (playerRoom.gameState.farms[playerKeyFarm].corn >= cornVictoryAmount) {
            io.to(playerRoom.id).emit('gameOver', {
              winner: playerId,
              reason: 'corn'
            });
            return;
          }
        } else if (action === 'unlock') {
          // Get the unlock cost from config
          const unlockCost = playerRoom.gameState.config.farming.unlockCost;
          
          // Unlock a new plot
          playerRoom.gameState.farms[playerKeyFarm].plots[plotIndex].state = 'empty';
          playerRoom.gameState.farms[playerKeyFarm].unlocked++;
          playerRoom.gameState.farms[playerKeyFarm].unlockable--;
          
          // Deduct unlock cost
          playerRoom.gameState.farms[playerKeyFarm].corn -= unlockCost;
          
          console.log(`Player ${playerId} unlocked plot ${plotIndex}. New corn: ${playerRoom.gameState.farms[playerKeyFarm].corn}`);
        }
        break;
        
      case 'endTurn':
        // Update chess engine state if provided
        if (data.chessEngineState) {
          playerRoom.gameState.chessEngineState = data.chessEngineState;
        }
        
        console.log(`Player ${playerId} ended their turn`);
        
        // Switch turns
        playerRoom.currentTurn = playerRoom.currentTurn === 'white' ? 'black' : 'white';
        console.log(`Turn switched to ${playerRoom.currentTurn}`);
        
        // Process farm growth for all players
        for (const playerKey in playerRoom.gameState.farms) {
          const farm = playerRoom.gameState.farms[playerKey];
          
          // Process each plot
          for (let i = 0; i < farm.plots.length; i++) {
            const plot = farm.plots[i];
            
            if (plot.state === 'planted') {
              // Decrement turns to harvest
              if (plot.turnsToHarvest > 0) {
                plot.turnsToHarvest--;
                
                // If ready to harvest, update state
                if (plot.turnsToHarvest === 0) {
                  plot.state = 'ready';
                }
              }
            }
          }
        }
        break;
    }
    
    // Broadcast updated game state to all players in the room
    io.to(playerRoom.id).emit('gameStateUpdate', {
      gameState: playerRoom.gameState,
      currentTurn: playerRoom.currentTurn
    });
    
    console.log(`Game state updated and broadcast to room ${playerRoom.id}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find and clean up any rooms this player was in
    for (const roomId in gameRooms) {
      const room = gameRooms[roomId];
      
      if (room.players[socket.id]) {
        // Remove player from room
        delete room.players[socket.id];
        
        // If room is empty, remove it
        if (Object.keys(room.players).length === 0) {
          delete gameRooms[roomId];
          console.log(`Room ${roomId} removed`);
        } else {
          // Notify remaining player
          io.to(roomId).emit('opponentLeft');
        }
        
        break;
      }
    }
  });
});

// Initialize game state
function initializeGameState() {
  // Get current configuration
  const currentConfig = gameConfig.getConfig().config;
  
  // Create initial farm plots for both players
  const player1Plots = [];
  const player2Plots = [];
  
  // Use config for number of plots
  const startingUnlockedPlots = currentConfig.startingUnlockedPlots;
  const startingUnlockablePlots = currentConfig.startingUnlockablePlots;
  const totalPlots = 15; // Fixed total for now
  
  // Create plots for each player 
  for (let i = 0; i < totalPlots; i++) {
    let state = 'locked';
    
    if (i < startingUnlockedPlots) {
      state = 'empty'; // First N plots are unlocked
    } else if (i < startingUnlockedPlots + startingUnlockablePlots) {
      state = 'unlockable'; // Next M plots are unlockable with corn
    }
    
    player1Plots.push({
      state: state,
      growthStage: 0,
      turnsToHarvest: 0
    });
    
    player2Plots.push({
      state: state,
      growthStage: 0,
      turnsToHarvest: 0
    });
  }
  
  // Initialize capture requirements for plots
  const player1CaptureRequired = [];
  const player2CaptureRequired = [];
  
  // Starting at plot index after the unlocked + unlockable
  let plotIndex = startingUnlockedPlots + startingUnlockablePlots;
  let capturesNeeded = 1; // First capture plot requires 1 capture
  const captureScaling = currentConfig.farming.captureScaling;
  
  // Create remaining plots with increasing capture requirements
  for (let i = 0; plotIndex < totalPlots; i++) {
    player1CaptureRequired.push({
      plot: plotIndex,
      capturesNeeded: capturesNeeded,
      unlocked: false
    });
    
    player2CaptureRequired.push({
      plot: plotIndex,
      capturesNeeded: capturesNeeded,
      unlocked: false
    });
    
    plotIndex++;
    
    // Increase captures required every other plot
    if (i % 2 === 1) {
      capturesNeeded *= captureScaling;
    }
  }
  
  return {
    // Initialize with the standard chess starting position in FEN notation
    chessEngineState: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    farms: {
      player1: {
        corn: currentConfig.startingCorn,
        unlocked: startingUnlockedPlots,
        unlockable: startingUnlockablePlots,
        captureRequired: player1CaptureRequired,
        totalCaptures: 0,
        plots: player1Plots
      },
      player2: {
        corn: currentConfig.startingCorn,
        unlocked: startingUnlockedPlots,
        unlockable: startingUnlockablePlots,
        captureRequired: player2CaptureRequired,
        totalCaptures: 0,
        plots: player2Plots
      }
    },
    // Use the current configuration
    config: currentConfig
  };
}

// Check if it's the player's turn
function isPlayerTurn(room, playerId) {
  const playerColor = room.players[playerId].color;
  return playerColor === room.currentTurn;
}

// Send game start to both players
function sendGameStart(room) {
  console.log(`Sending game start for room ${room.id}`);
  
  // Initialize the chess engine for the room if not already initialized
  if (!room.gameState.chessEngineState) {
    console.log('Initializing chess engine for the room with default position');
    const chess = new Chess();
    room.gameState.chessEngineState = chess.fen();
  }
  
  console.log(`Initial chess engine state: ${room.gameState.chessEngineState}`);
  console.log(`Current turn: ${room.currentTurn}`);
  
  // Find white and black players from the players object
  const playerIds = Object.keys(room.players);
  
  if (playerIds.length !== 2) {
    console.log(`Room doesn't have exactly 2 players, has ${playerIds.length} instead`);
    return;
  }
  
  // Send game start event to each player
  for (const playerId of playerIds) {
    console.log(`Sending game start to player ${playerId} with color ${room.players[playerId].color}`);
    io.to(playerId).emit('gameStart', {
      gameState: room.gameState,
      currentTurn: room.currentTurn
    });
  }
  
  console.log('Game start sent to both players');
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 