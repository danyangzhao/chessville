// Game state management module

const GameState = (() => {
  // Private variables
  let gameState = {};
  let chess = null;
  let currentTurn = 'white';
  
  // Default crop data
  const defaultCropData = {
    corn: {
      cost: 10,
      yield: 3,
      growthTime: 3,
      growthStages: ['seedling', 'growing', 'mature']
    },
    wheat: {
      cost: 20,
      yield: 7,
      growthTime: 5,
      growthStages: ['seedling', 'growing', 'mature']
    },
    carrot: {
      cost: 30,
      yield: 12,
      growthTime: 7,
      growthStages: ['seedling', 'growing', 'mature']
    }
  };
  
  // Player state
  const playerState = {
    playerId: null,
    playerColor: null,
    roomId: null,
    isMyTurn: false,
    selectedPiece: null,
    selectedPlot: null,
    selectedPlantType: 'corn'
  };
  
  // Public methods
  return {
    initialize() {
      console.log('Initializing game state');
      
      // Reset game state
      gameState = {
        farms: {
          player1: { corn: 100, plots: [] },
          player2: { corn: 100, plots: [] }
        }
      };
      
      // Initialize chess engine if possible
      if (typeof Chess !== 'undefined') {
        chess = new Chess();
        gameState.chessEngineState = chess.fen();
      }
    },
    
    getPlayerState() {
      return playerState;
    },
    
    getGameState() {
      return gameState;
    },
    
    getChess() {
      return chess;
    },
    
    getCurrentTurn() {
      return currentTurn;
    },
    
    getCropData() {
      return defaultCropData;
    },
    
    setPlayerColor(color) {
      playerState.playerColor = color;
      console.log(`Player color set to: ${color}`);
    },
    
    setRoomId(roomId) {
      playerState.roomId = roomId;
      console.log(`Room ID set to: ${roomId}`);
    },
    
    setPlayerId(id) {
      playerState.playerId = id;
      console.log(`Player ID set to: ${id}`);
    },
    
    updateGameState(newState, turn) {
      if (newState) {
        gameState = newState;
      }
      
      if (turn) {
        currentTurn = turn;
        playerState.isMyTurn = playerState.playerColor === turn;
      }
      
      console.log(`Game state updated. Current turn: ${currentTurn}`);
      console.log(`Is my turn: ${playerState.isMyTurn}`);
      
      return gameState;
    },
    
    updateChessEngine(fen) {
      try {
        if (typeof Chess === 'undefined') {
          console.error('Chess library not loaded');
          return false;
        }
        
        if (fen && fen !== '8/8/8/8/8/8/8/8 w - - 0 1') {
          chess = new Chess(fen);
          gameState.chessEngineState = fen;
          return true;
        } else {
          chess = new Chess();
          gameState.chessEngineState = chess.fen();
          return true;
        }
      } catch (error) {
        console.error('Error updating chess engine:', error);
        return false;
      }
    },
    
    makeMove(from, to) {
      if (!chess) return false;
      
      try {
        const move = chess.move({
          from: from,
          to: to,
          promotion: 'q' // Always promote to queen for simplicity
        });
        
        if (move) {
          gameState.chessEngineState = chess.fen();
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error making move:', error);
        return false;
      }
    },
    
    isCheckmate() {
      return chess ? chess.in_checkmate() : false;
    },
    
    isPlayerTurn() {
      return playerState.isMyTurn;
    },
    
    getPlayerFarmKey() {
      return playerState.playerColor === 'white' ? 'player1' : 'player2';
    },
    
    getOpponentFarmKey() {
      return playerState.playerColor === 'white' ? 'player2' : 'player1';
    },
    
    restoreConfigurations() {
      // Ensure properties are restored for each crop type
      if (gameState.crops) {
        Object.entries(gameState.crops).forEach(([cropName, crop]) => {
          if (!crop.growthStages && defaultCropData[cropName] && defaultCropData[cropName].growthStages) {
            console.log(`Restoring missing property growthStages for ${cropName}`);
            crop.growthStages = defaultCropData[cropName].growthStages;
          }
        });
      }
    }
  };
})(); 