// Client-side game logic for multiplayer Chess Farmer

// Game state (will be synchronized with server)
let gameState = {
  chessEngine: null,
  farms: {
    player1: {
      corn: 100,
      unlocked: 2,
      unlockable: 3,
      captureRequired: [],
      totalCaptures: 0,
      plots: []
    },
    player2: {
      corn: 100,
      unlocked: 2,
      unlockable: 3,
      captureRequired: [],
      totalCaptures: 0,
      plots: []
    }
  },
  config: {
    moveCosts: {
      p: 5,  // pawn
      n: 10, // knight
      b: 8,  // bishop
      r: 12, // rook
      q: 15, // queen
      k: 7   // king
    },
    farming: {
      plants: {
        corn: { 
          seedCost: 3,
          harvestYield: 10,
          growthStages: 3,
          growthTime: 3,
          emoji: "🌽" 
        },
        wheat: { 
          seedCost: 2,
          harvestYield: 6,
          growthStages: 2,
          growthTime: 2,
          emoji: "🌾" 
        },
        carrot: { 
          seedCost: 4,
          harvestYield: 12,
          growthStages: 3,
          growthTime: 3,
          emoji: "🥕" 
        },
        potato: { 
          seedCost: 5,
          harvestYield: 15,
          growthStages: 4,
          growthTime: 4,
          emoji: "🥔" 
        }
      },
      seedCost: 3, // Default/legacy value
      harvestYield: 10, // Default/legacy value
      growthStages: 3, // Default/legacy value
      unlockCost: 5,
      captureScaling: 3
    }
  },
  currentTurn: 'white'
};

// Client state
let clientState = {
  socket: null,
  roomId: null,
  playerId: null,
  playerColor: null,
  isMyTurn: false,
  selectedPiece: null,
  selectedPlot: null,
  selectedPlantType: 'corn' // Default selected plant type
};

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, initializing game...');
  
  // Initialize screens
  initializeScreens();
  
  // Initialize Socket.io connection
  clientState.socket = io(window.location.origin);
  
  // Set up event listeners
  setupSocketListeners();
  setupUIEventListeners();
  
  // Load chess.js library
  if (typeof Chess === 'undefined') {
    loadChessLibrary(function() {
      console.log('Chess.js library loaded successfully');
    });
  }
});

// Initialize screens with proper display properties
function initializeScreens() {
  // First, hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  
  // Make sure the login screen is visible initially
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    loginScreen.classList.remove('hidden');
  }
}

// Load chess.js library dynamically if not already loaded
function loadChessLibrary(callback) {
  if (typeof Chess !== 'undefined') {
    callback();
    return;
  }
  
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js';
  script.onload = callback;
  document.head.appendChild(script);
}

// Set up Socket.io event listeners
function setupSocketListeners() {
  console.log('Setting up socket listeners');
  
  // Handle connection event
  clientState.socket.on('connect', () => {
    console.log('Connected to server with socket ID:', clientState.socket.id);
  });
  
  // Handle connection error
  clientState.socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    showMessage('Error connecting to server. Please try again.');
  });
  
  // Handle player assignment
  clientState.socket.on('playerAssigned', (data) => {
    console.log('Player assigned:', data);
    
    // Store player data
    clientState.playerColor = data.color;
    clientState.roomId = data.roomId;
    clientState.playerId = data.playerId || clientState.socket.id; // Set playerId to socket.id if not provided
    
    console.log(`Assigned as player ${clientState.playerId} with color ${clientState.playerColor} in room ${clientState.roomId}`);
    
    // Show waiting screen and update room info
    showScreen('waiting-screen');
    updateRoomInfo();
  });
  
  // Handle room full event
  clientState.socket.on('roomFull', () => {
    console.log('Room full event received');
    showMessage('This room is full. Please try another room.');
    showScreen('login-screen');
  });
  
  // Handle game start
  clientState.socket.on('gameStart', (data) => {
    console.log('Game start event received:', data);
    console.log('Raw game state from server:', JSON.stringify(data.gameState));
    
    // Initialize game state
    gameState = data.gameState;
    
    // Capture the current turn from the server explicitly
    gameState.currentTurn = data.currentTurn || 'white';
    console.log(`Current turn from server: ${gameState.currentTurn}`);
    
    // Set up the chess engine with the initial state
    try {
      if (gameState.chessEngineState) {
        console.log('Using provided chess engine state:', gameState.chessEngineState);
        
        // Validate the FEN - make sure it's not an empty board
        const boardPart = gameState.chessEngineState.split(' ')[0];
        if (boardPart === "8/8/8/8/8/8/8/8") {
          console.warn("Received invalid empty board FEN from server, using default position instead");
          gameState.chessEngine = new Chess();
          gameState.chessEngineState = gameState.chessEngine.fen();
        } else {
          gameState.chessEngine = new Chess(gameState.chessEngineState);
        }
      } else {
        console.log('Initializing new chess engine with default position');
        gameState.chessEngine = new Chess();
        // Save the initial state back to the game state
        gameState.chessEngineState = gameState.chessEngine.fen();
      }
      
      console.log('Chess engine initialized successfully with FEN:', gameState.chessEngine.fen());
      
      // Store this initial state for potential recovery
      gameState.previousChessEngineState = gameState.chessEngine.fen();
    } catch (error) {
      console.error('Error initializing chess engine:', error);
      console.log('Attempting to initialize with default position');
      gameState.chessEngine = new Chess();
      gameState.chessEngineState = gameState.chessEngine.fen();
      gameState.previousChessEngineState = gameState.chessEngine.fen();
    }
    
    // Set initial turn state
    clientState.isMyTurn = clientState.playerColor === gameState.currentTurn;
    console.log(`Initial turn state: ${clientState.isMyTurn ? 'My turn' : 'Opponent\'s turn'}`);
    
    // Show game screen first
    showScreen('game-screen');
    
    // Initialize the farms
    initializeFarms();
    
    // Add a slightly longer delay for board initialization to ensure the DOM is fully ready
    setTimeout(() => {
      console.log('Initializing chess board after delay');
      // Initialize the board directly instead of calling initializeChessBoard
      updateChessBoardDisplay();
      updateCornCounts();
      updateTurnIndicator();
      updateRoomInfo();
    }, 300);
  });
  
  // Handle game state updates
  clientState.socket.on('gameStateUpdate', (data) => {
    console.log('Game state update received:', data);
    
    // Save a reference to the existing config
    const existingConfig = gameState.config;
    // Save the current chess state before updating
    const previousChessState = gameState.chessEngine ? gameState.chessEngine.fen() : null;
    
    // Update the game state
    gameState = data.gameState;
    gameState.previousChessEngineState = previousChessState; // Store for recovery if needed
    
    // Restore any previously set configuration
    if (existingConfig) {
        gameState.config = existingConfig;
    }
    
    // Ensure properties are restored for each crop type
    if (gameState.crops) {
        Object.entries(gameState.crops).forEach(([cropName, crop]) => {
            if (!crop.growthStages && defaultCropData[cropName] && defaultCropData[cropName].growthStages) {
                console.log(`Restoring missing property growthStages for ${cropName}`);
                crop.growthStages = defaultCropData[cropName].growthStages;
            }
        });
    }
    
    // Store the current turn from the server
    gameState.currentTurn = data.currentTurn;
    console.log(`Current turn from server: ${gameState.currentTurn}`);
    
    // Update the chess engine with the new state
    if (gameState.chessEngineState) {
        console.log('Updating chess engine with state:', gameState.chessEngineState);
        
        // Validate the FEN - make sure it's not an empty board
        const boardPart = gameState.chessEngineState.split(' ')[0];
        if (boardPart === "8/8/8/8/8/8/8/8" && previousChessState) {
            console.warn("Received empty board FEN from server, using previous state instead");
            gameState.chessEngineState = previousChessState;
        }
        
        try {
            // Create a new chess engine instance with the FEN state from the server
            gameState.chessEngine = new Chess(gameState.chessEngineState);
            
            // Check if the chess engine turn matches the game state turn
            const chessEngineTurn = gameState.chessEngine.turn();
            const expectedTurn = gameState.currentTurn === 'white' ? 'w' : 'b';
            console.log(`Chess engine turn: ${chessEngineTurn}, Expected: ${expectedTurn}`);
            
            // If there's a mismatch, we need to fix it safely
            if (chessEngineTurn !== expectedTurn) {
                console.warn(`Turn mismatch detected! Will create a fixed chess engine state.`);
                
                // Get the current position from the chess engine
                const position = gameState.chessEngine.fen();
                
                // Safely update just the turn portion (the second part when split by spaces)
                const parts = position.split(' ');
                if (parts.length >= 2) {
                    parts[1] = expectedTurn;
                    const fixedFen = parts.join(' ');
                    console.log(`Original FEN: ${position}`);
                    console.log(`Fixed FEN: ${fixedFen}`);
                    
                    // Create a new chess engine with the fixed FEN
                    try {
                        const fixedEngine = new Chess(fixedFen);
                        // Verify that the fixed engine has pieces
                        const boardString = fixedEngine.fen().split(' ')[0];
                        if (boardString.includes('p') || boardString.includes('P')) {
                            console.log(`Fixed engine created successfully with pieces on the board`);
                            gameState.chessEngine = fixedEngine;
                            gameState.chessEngineState = fixedFen;
                        } else {
                            console.error(`Fixed engine has no pieces! Keeping original engine and trying alternative fix.`);
                            // If we have a previous state with pieces, try to use that instead
                            if (previousChessState) {
                                try {
                                    const recoveryEngine = new Chess(previousChessState);
                                    const recoveryParts = previousChessState.split(' ');
                                    recoveryParts[1] = expectedTurn; // Fix the turn
                                    const recoveryFen = recoveryParts.join(' ');
                                    const finalEngine = new Chess(recoveryFen);
                                    
                                    console.log(`Recovered chess engine from previous state with turn fixed`);
                                    gameState.chessEngine = finalEngine;
                                    gameState.chessEngineState = recoveryFen;
                                } catch (e) {
                                    console.error(`Recovery failed: ${e}`);
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`Error creating fixed engine: ${err}. Keeping original engine.`);
                    }
                }
            }
            
            console.log('Chess engine updated successfully, FEN:', gameState.chessEngine.fen());
        } catch (error) {
            console.error('Error updating chess engine:', error);
            // If there's an error, try the previous state or initialize with default position
            if (previousChessState) {
                try {
                    console.log(`Trying to recover with previous state: ${previousChessState}`);
                    gameState.chessEngine = new Chess(previousChessState);
                    gameState.chessEngineState = previousChessState;
                } catch (e) {
                    console.error(`Recovery failed: ${e}`);
                    gameState.chessEngine = new Chess();
                }
            } else {
                gameState.chessEngine = new Chess();
            }
        }
    } else {
        console.warn('No chess engine state received from server, initializing with default position');
        gameState.chessEngine = new Chess();
    }
    
    // Update turn state
    const previousTurnState = clientState.isMyTurn;
    clientState.isMyTurn = clientState.playerColor === data.currentTurn;
    console.log(`Turn updated: Was ${previousTurnState ? 'my turn' : 'not my turn'} -> Now ${clientState.isMyTurn ? 'my turn' : 'not my turn'}`);
    console.log(`Player color: ${clientState.playerColor}, Current turn: ${data.currentTurn}, Is my turn: ${clientState.isMyTurn}`);
    
    // Get the proper player key for farm initialization
    const playerKey = clientState.playerColor === 'white' ? 'player1' : 'player2';
    console.log(`Reinitializing farm for ${playerKey} after game state update`);
    initializePlayerFarm(playerKey);

    // Check for any capture-unlocked plots that may have changed
    if (gameState.players && gameState.players[clientState.playerId] && gameState.players[clientState.playerId].farm) {
        const farm = gameState.players[clientState.playerId].farm;
        for (let i = 0; i < farm.plots.length; i++) {
            if (farm.plots[i].state === 'unlocked' && farm.plots[i].unlockSource === 'capture') {
                console.log(`Plot ${i} was unlocked due to a capture!`);
                // You could add a UI notification here
            }
        }
    }

    // Update the UI
    updateCornCounts();
    updateChessBoardDisplay();
  });
  
  // Handle game over
  clientState.socket.on('gameOver', (data) => {
    console.log('Game over:', data);
    
    // Show game over message
    const isWinner = data.winner === clientState.playerId;
    const message = isWinner ? 
      `You won! ${data.reason === 'corn' ? 'You collected 200 corn!' : 'You checkmated your opponent!'}` :
      `You lost. ${data.reason === 'corn' ? 'Your opponent collected 200 corn.' : 'Your king was checkmated.'}`;
    
    showVictoryBanner(isWinner, message);
  });
  
  // Handle opponent leaving
  clientState.socket.on('opponentLeft', () => {
    console.log('Opponent left the game');
    showMessage('Your opponent has left the game.');
  });

  // Add handler for config updates
  clientState.socket.on('configUpdate', (data) => {
    console.log('Game configuration update received:', data);
    
    // Update the game config with the new values
    if (data.config) {
      gameState.config = data.config;
      console.log('Game configuration updated to version:', data.version);
      
      // If we're in a game, update the UI to reflect any immediate changes
      if (gameState.farms) {
        // Refresh farm displays
        initializePlayerFarm('player1');
        initializePlayerFarm('player2');
        
        // Update other UI elements
        updateCornCounts();
        
        // Show notification
        showMessage('Game configuration has been updated!');
      }
    }
  });
}

// Set up UI event listeners
function setupUIEventListeners() {
  // Login form submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const roomId = document.getElementById('room-id').value.trim();
      
      if (roomId) {
        // Join the specified room
        clientState.socket.emit('joinGame', { roomId });
        console.log(`Attempting to join room: ${roomId}`);
      } else {
        // Create a new room
        clientState.socket.emit('joinGame', {});
        console.log('Creating a new room');
      }
    });
  }
}

// Initialize the chess board
function initializeChessBoard() {
  const chessBoard = document.getElementById('chess-board');
  if (!chessBoard) {
    console.error('Chess board element not found!');
    return;
  }
  
  console.log('Initializing chess board');
  
  // Clear existing board
  chessBoard.innerHTML = '';
  
  // Create 8x8 grid
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.className = 'chess-square';
      square.dataset.row = row;
      square.dataset.col = col;
      square.id = `square-${row}-${col}`;  // Also add an ID for direct selection
      
      // Set square color
      if ((row + col) % 2 === 0) {
        square.classList.add('light');
      } else {
        square.classList.add('dark');
      }
      
      // Add click event listener
      square.addEventListener('click', handleChessSquareClick);
      
      chessBoard.appendChild(square);
    }
  }
  
  console.log('Chess board grid created');
}

// Initialize farms
function initializeFarms() {
  const playerKey = clientState.playerColor === 'white' ? 'player1' : 'player2';
  initializePlayerFarm(playerKey);
}

// Initialize a player's farm
function initializePlayerFarm(playerKey) {
  const farmContainer = document.getElementById('my-farm');
  if (!farmContainer) {
    console.error('Farm container not found');
    return;
  }
  
  // If playerKey is null or undefined, use the client's actual player key
  if (!playerKey) {
    console.warn('PlayerKey is null, using color-based player key');
    playerKey = clientState.playerColor === 'white' ? 'player1' : 'player2';
  }
  
  // Clear existing farm
  farmContainer.innerHTML = '';
  
  // Get farm data
  const farm = gameState.farms[playerKey];
  if (!farm) {
    console.error(`Farm data not found for ${playerKey}`);
    return;
  }
  
  console.log(`Initializing farm for ${playerKey} with ${farm.plots.length} plots`);
  
  // Create farm plots
  for (let i = 0; i < farm.plots.length; i++) {
    const plot = document.createElement('div');
    plot.className = 'farm-plot';
    plot.dataset.index = i;
    plot.dataset.player = playerKey;
    
    // Set plot state
    updatePlotDisplay(plot, farm.plots[i]);
    
    // Add click event listener
    plot.addEventListener('click', handleFarmPlotClick);
    
    // Log the plot's actions
    const actions = plot.querySelectorAll('.plot-action');
    console.log(`Plot ${i} has ${actions.length} action buttons`);
    
    farmContainer.appendChild(plot);
  }
  
  console.log(`Farm initialized with ${farm.plots.length} plots`);
  updateCornCounts();
}

// Update the chess board display
function updateChessBoardDisplay() {
  console.log("Updating chess board display");
  
  if (!gameState.chessEngine) {
    console.error("Chess engine is not initialized!");
    return;
  }
  
  const fen = gameState.chessEngine.fen();
  console.log("Current FEN:", fen);
  
  // Get the chess board element
  const chessBoard = document.getElementById('chess-board');
  if (!chessBoard) {
    console.error("Chess board element not found!");
    return;
  }
  
  // Clear the board and recreate it
  chessBoard.innerHTML = '';
  
  // Determine if we should reverse the board (for black player)
  const isBlackPlayer = clientState.playerColor === 'black';
  console.log(`Player is black: ${isBlackPlayer}`);
  
  // Create 8x8 grid
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // For visual position (flipped for black)
      const displayRow = isBlackPlayer ? 7 - row : row;
      const displayCol = isBlackPlayer ? 7 - col : col;
      
      const square = document.createElement('div');
      square.className = 'chess-square';
      
      // We always keep the logical coordinates in the dataset for the game logic
      square.dataset.row = row;
      square.dataset.col = col;
      square.id = `square-${row}-${col}`;
      
      // Set visual position using CSS grid
      square.style.gridRow = displayRow + 1;
      square.style.gridColumn = displayCol + 1;
      
      // Set square color based on logical position (not display position)
      if ((row + col) % 2 === 0) {
        square.classList.add('light');
      } else {
        square.classList.add('dark');
      }
      
      // Add click event listener
      square.addEventListener('click', handleChessSquareClick);
      
      chessBoard.appendChild(square);
    }
  }
  
  // Now add the pieces based on the FEN string
  const fenParts = fen.split(' ');
  const fenBoard = fenParts[0];
  const rows = fenBoard.split('/');
  console.log("Parsing FEN board:", rows);
  
  let squareIndex = 0;
  for (let row = 0; row < 8; row++) {
    let col = 0;
    for (let i = 0; i < rows[row].length; i++) {
      const char = rows[row][i];
      
      if (!isNaN(char)) {
        // Skip empty squares
        col += parseInt(char);
      } else {
        // Add piece
        const square = document.getElementById(`square-${row}-${col}`);
        if (square) {
          const color = char === char.toUpperCase() ? 'white' : 'black';
          const pieceName = getPieceName(char);
          
          const pieceDiv = document.createElement('div');
          pieceDiv.className = `chess-piece ${color} ${pieceName}`;
          pieceDiv.style.position = 'absolute';
          pieceDiv.style.width = '80%';
          pieceDiv.style.height = '80%';
          pieceDiv.style.top = '10%';
          pieceDiv.style.left = '10%';
          pieceDiv.style.zIndex = '10';
          pieceDiv.style.pointerEvents = 'none'; // Allow clicks to pass through to the square
          
          square.appendChild(pieceDiv);
          console.log(`Added ${color} ${pieceName} to square-${row}-${col}`);
        } else {
          console.error(`Square element not found for row ${row}, col ${col}`);
        }
        
        col++;
      }
    }
  }
  
  // If there's a selected piece, highlight it and its valid moves
  if (clientState.selectedPiece) {
    const { row, col } = clientState.selectedPiece;
    const selectedSquare = document.getElementById(`square-${row}-${col}`);
    if (selectedSquare) {
      selectedSquare.classList.add('selected');
      
      // Highlight valid moves
      displayValidMoves();
    }
  }
  
  console.log("Chess board display updated");
}

// Display valid moves for the selected piece
function displayValidMoves() {
  if (!clientState.selectedPiece) return;
  
  // Clear any previous highlighting first
  document.querySelectorAll('.chess-square.valid-move, .chess-square.valid-capture').forEach(el => {
    el.classList.remove('valid-move', 'valid-capture');
  });
  
  // Get the algebraic position of the selected piece
  const fromAlgebraic = algebraicPosition(clientState.selectedPiece.row, clientState.selectedPiece.col);
  
  // Get valid moves directly from the chess engine
  const validMoves = gameState.chessEngine.moves({
    square: fromAlgebraic,
    verbose: true
  });
  
  console.log("Valid moves:", validMoves.map(move => `${move.from}->${move.to}`));
  
  // Highlight valid moves
  validMoves.forEach(move => {
    // Convert algebraic destination to row/col
    const coords = squareToCoordinates(move.to);
    const targetSquare = document.getElementById(`square-${coords.row}-${coords.col}`);
    
    if (targetSquare) {
      if (move.captured) {
        targetSquare.classList.add('valid-capture');
        console.log(`Highlighting valid capture at ${coords.row},${coords.col} (${move.to})`);
      } else {
        targetSquare.classList.add('valid-move');
        console.log(`Highlighting valid move at ${coords.row},${coords.col} (${move.to})`);
      }
    }
  });
}

// Update plot display
function updatePlotDisplay(plotElement, plotData) {
  // Remove all state classes
  plotElement.classList.remove('empty', 'planted', 'ready', 'locked', 'unlockable');
  
  // Add appropriate class based on state
  plotElement.classList.add(plotData.state);
  
  // Clear previous content
  plotElement.innerHTML = '';
  
  // Check if plant config exists
  if (!gameState.config || !gameState.config.farming || !gameState.config.farming.plants) {
    console.warn("Plant configuration missing in updatePlotDisplay, restoring defaults");
    if (!gameState.config) gameState.config = {};
    if (!gameState.config.farming) gameState.config.farming = {};
    
    // Restore the default plant configuration
    gameState.config.farming.plants = {
      corn: { emoji: "🌽" },
      wheat: { emoji: "🌾" },
      carrot: { emoji: "🥕" },
      potato: { emoji: "🥔" }
    };
  }
  
  // Add growth stage indicator if planted
  if (plotData.state === 'planted') {
    const plantType = plotData.plantType || 'corn'; // Default to corn for backward compatibility
    // Make sure the plant type exists in config
    if (!gameState.config.farming.plants[plantType]) {
      console.warn(`Plant type ${plantType} not found in plot display, using corn`);
      plotData.plantType = 'corn';
    }
    const plant = gameState.config.farming.plants[plantType];
    const emoji = plant.emoji;
    plotElement.innerHTML = `<div class="growth-indicator stage-${plotData.growthStage} ${plantType}-plant">${emoji}</div>`;
  } else if (plotData.state === 'ready') {
    const plantType = plotData.plantType || 'corn'; // Default to corn for backward compatibility
    // Make sure the plant type exists in config
    if (!gameState.config.farming.plants[plantType]) {
      console.warn(`Plant type ${plantType} not found in plot display, using corn`);
      plotData.plantType = 'corn';
    }
    const plant = gameState.config.farming.plants[plantType];
    const emoji = plant.emoji;
    plotElement.innerHTML = `<div class="growth-indicator ready ${plantType}-plant">${emoji}</div>`;
  } else if (plotData.state === 'empty') {
    plotElement.innerHTML = '<div class="plot-icon">🟫</div>';
  } else if (plotData.state === 'locked') {
    plotElement.innerHTML = '<div class="plot-icon">🔒</div>';
  } else if (plotData.state === 'unlockable') {
    plotElement.innerHTML = '<div class="plot-icon">🔓</div>';
  }
  
  // Log the plot state
  console.log(`Updating plot to state: ${plotData.state}, player: ${plotElement.dataset.player}`);
  
  // Add appropriate action button based on state
  const isMyFarm = plotElement.dataset.player === 'player1' && clientState.playerColor === 'white' || 
                  plotElement.dataset.player === 'player2' && clientState.playerColor === 'black';
  
  // Check the turn state
  const isCurrentTurn = isMyTurn();
  console.log(`Is my farm: ${isMyFarm}, Is my turn: ${isCurrentTurn}, Current turn: ${gameState.currentTurn}, Player color: ${clientState.playerColor}`);
  
  if (isMyFarm) {
    // Always add the action button but control visibility with CSS
    const action = document.createElement('div');
    action.className = 'plot-action';
    
    if (plotData.state === 'empty') {
      action.textContent = '🌱 Plant';
      action.style.display = isCurrentTurn ? 'block' : 'none';
      action.onclick = (event) => {
        event.stopPropagation();
        showPlantSelector(plotElement.dataset.index, plotElement.dataset.player);
      };
      plotElement.appendChild(action);
    } else if (plotData.state === 'ready') {
      action.textContent = '🌽 Harvest';
      action.style.display = isCurrentTurn ? 'block' : 'none';
      action.onclick = (event) => {
        event.stopPropagation();
        handleHarvestAction(plotElement.dataset.index, plotElement.dataset.player);
      };
      plotElement.appendChild(action);
    } else if (plotData.state === 'unlockable') {
      action.textContent = '🔓 Unlock';
      action.style.display = isCurrentTurn ? 'block' : 'none';
      action.onclick = (event) => {
        event.stopPropagation();
        handleUnlockAction(plotElement.dataset.index, plotElement.dataset.player);
      };
      plotElement.appendChild(action);
    }
  }
}

// Show plant selector overlay
function showPlantSelector(plotIndex, playerKey) {
  // Store the current target for planting
  clientState.selectedPlot = {
    index: plotIndex,
    player: playerKey
  };
  
  console.log(`Showing plant selector for plot ${plotIndex}, player ${playerKey}`);
  
  // Debug info - check if plant config exists
  if (!gameState.config || !gameState.config.farming || !gameState.config.farming.plants) {
    console.warn("Plant configuration missing in showPlantSelector, this may cause issues");
  } else {
    console.log("Available plant types:", Object.keys(gameState.config.farming.plants));
    for (const plantType in gameState.config.farming.plants) {
      const plant = gameState.config.farming.plants[plantType];
      console.log(`${plantType} config:`, {
        seedCost: plant.seedCost,
        harvestYield: plant.harvestYield,
        growthTime: plant.growthTime
      });
    }
  }
  
  // Get plant selector elements
  const overlay = document.getElementById('plant-selector-overlay');
  const options = document.querySelectorAll('.plant-option');
  const cancelBtn = document.querySelector('.plant-selector-cancel');
  const confirmBtn = document.querySelector('.plant-selector-confirm');
  
  // Remove existing event listeners by cloning and replacing elements
  const plantOptions = document.querySelector('.plant-options');
  const newPlantOptions = plantOptions.cloneNode(true);
  plantOptions.parentNode.replaceChild(newPlantOptions, plantOptions);
  
  const btnContainer = document.querySelector('.plant-selector-buttons');
  const newBtnContainer = btnContainer.cloneNode(true);
  btnContainer.parentNode.replaceChild(newBtnContainer, btnContainer);
  
  // Get fresh references after replacing
  const freshOptions = document.querySelectorAll('.plant-option');
  const freshCancelBtn = document.querySelector('.plant-selector-cancel');
  const freshConfirmBtn = document.querySelector('.plant-selector-confirm');
  
  // Show the overlay
  overlay.classList.add('visible');
  
  // Select the default plant option
  let selectedFound = false;
  freshOptions.forEach(option => {
    option.classList.remove('selected');
    if (option.dataset.plant === clientState.selectedPlantType) {
      option.classList.add('selected');
      selectedFound = true;
      console.log(`Selected previous plant type: ${option.dataset.plant}`);
    }
  });
  
  // If no plant type was previously selected, default to corn
  if (!selectedFound && freshOptions.length > 0) {
    const cornOption = document.querySelector('.plant-option[data-plant="corn"]');
    if (cornOption) {
      cornOption.classList.add('selected');
      clientState.selectedPlantType = 'corn';
      console.log(`No previous selection, defaulting to corn`);
    } else {
      console.warn(`Corn option not found in the plant selector`);
    }
  }
  
  // Add event listeners for plant selection
  freshOptions.forEach(option => {
    console.log(`Adding event listener for ${option.dataset.plant} option`);
    option.addEventListener('click', function() {
      // Remove selected class from all options
      freshOptions.forEach(opt => opt.classList.remove('selected'));
      // Add selected class to clicked option
      this.classList.add('selected');
      // Store the selected plant type
      clientState.selectedPlantType = this.dataset.plant;
      console.log(`Selected plant type: ${clientState.selectedPlantType}`);
    });
  });
  
  // Add event listener for cancel button
  freshCancelBtn.addEventListener('click', function() {
    console.log('Plant selection cancelled');
    overlay.classList.remove('visible');
    clientState.selectedPlot = null;
  });
  
  // Add event listener for confirm button
  freshConfirmBtn.addEventListener('click', function() {
    console.log('Plant selection confirmed');
    overlay.classList.remove('visible');
    if (clientState.selectedPlot) {
      console.log(`Planting ${clientState.selectedPlantType} in plot ${clientState.selectedPlot.index}`);
      handlePlantAction(
        clientState.selectedPlot.index,
        clientState.selectedPlot.player,
        clientState.selectedPlantType
      );
    } else {
      console.error("Cannot plant - selectedPlot is null");
    }
  });
}

// Helper functions for farm actions
function handlePlantAction(index, playerKey, plantType = 'corn') {
  console.log(`handlePlantAction called: index=${index}, playerKey=${playerKey}, plantType=${plantType}`);
  console.log(`Current player: color=${clientState.playerColor}, isMyTurn=${isMyTurn()}`);
  
  if (!isMyTurn()) {
    console.log("Not my turn, cannot plant");
    return;
  }
  
  // Map the player key based on color
  const playerKeyMapped = (playerKey === 'player1' && clientState.playerColor === 'white') || 
                         (playerKey === 'player2' && clientState.playerColor === 'black') 
                         ? playerKey : null;
  
  if (!playerKeyMapped) {
    console.error(`Invalid player key mapping: ${playerKey} for color ${clientState.playerColor}`);
    return;
  }
  
  const plotData = gameState.farms[playerKeyMapped].plots[index];

  // Check if the plant configuration exists, if not recreate it
  if (!gameState.config || !gameState.config.farming || !gameState.config.farming.plants) {
    console.warn("Plant configuration missing, restoring defaults");
    if (!gameState.config) gameState.config = {};
    if (!gameState.config.farming) gameState.config.farming = {};
    
    // Restore the default plant configuration
    gameState.config.farming.plants = {
      corn: { 
        seedCost: 3,
        harvestYield: 10,
        growthStages: 3,
        growthTime: 3,
        emoji: "🌽" 
      },
      wheat: { 
        seedCost: 2,
        harvestYield: 6,
        growthStages: 2,
        growthTime: 2,
        emoji: "🌾" 
      },
      carrot: { 
        seedCost: 4,
        harvestYield: 12,
        growthStages: 3,
        growthTime: 3,
        emoji: "🥕" 
      },
      potato: { 
        seedCost: 5,
        harvestYield: 15,
        growthStages: 4,
        growthTime: 4,
        emoji: "🥔" 
      }
    };
  }
  
  // Make sure the specific plant type exists
  if (!gameState.config.farming.plants[plantType]) {
    console.warn(`Plant type ${plantType} not found in config, defaulting to corn`);
    plantType = 'corn';
  }
  
  const plant = gameState.config.farming.plants[plantType];
  
  // Default seed costs for each plant type if undefined
  const defaultSeedCosts = {
    corn: 3,
    wheat: 2, 
    carrot: 4,
    potato: 5
  };
  
  // Use plant.seedCost if available, otherwise use default
  const seedCost = plant.seedCost !== undefined ? plant.seedCost : defaultSeedCosts[plantType];
  
  console.log(`Attempting to plant ${plantType} (cost: ${seedCost}) with available corn: ${gameState.farms[playerKeyMapped].corn}`);
  
  if (gameState.farms[playerKeyMapped].corn >= seedCost) {
    // Update client-side state
    plotData.state = 'planted';
    plotData.plantType = plantType;
    plotData.growthStage = 1;
    plotData.turnsToHarvest = plant.growthTime || 3; // Default to 3 if undefined
    gameState.farms[playerKeyMapped].corn -= seedCost;
    
    // Send farm action to server
    clientState.socket.emit('gameAction', {
      type: 'farmAction',
      farmAction: 'plant',
      plotIndex: index,
      plantType: plantType,
      chessEngineState: gameState.chessEngine.fen()
    });
    
    // Update UI
    updateCornCounts();
    const plot = document.querySelector(`.farm-plot[data-index="${index}"][data-player="${playerKeyMapped}"]`);
    if (plot) {
      updatePlotDisplay(plot, plotData);
      console.log(`Updated plot display for index ${index}`);
    } else {
      console.error(`Could not find plot element for index ${index}, player ${playerKeyMapped}`);
    }
    
    console.log(`Planted ${plantType} in plot ${index}. New corn: ${gameState.farms[playerKeyMapped].corn}`);
    showMessage(`Planted ${plantType}!`);
    
    // End turn after a short delay
    setTimeout(() => {
      console.log(`Is still my turn before ending? ${isMyTurn()}, Player color: ${clientState.playerColor}`);
      if (isMyTurn()) {
        endTurn();
      } else {
        console.warn("Not ending turn because it's no longer my turn");
      }
    }, 800);
  } else {
    showMessage(`Not enough corn! You need ${seedCost} corn to plant ${plantType}.`);
    console.warn(`Not enough corn to plant ${plantType}. Have ${gameState.farms[playerKeyMapped].corn}, need ${seedCost}`);
  }
}

// Update corn counts
function updateCornCounts() {
  const myColor = clientState.playerColor;
  const myKey = myColor === 'white' ? 'player1' : 'player2';
  
  const myCornElement = document.getElementById('my-corn');
  
  if (myCornElement && gameState.farms && gameState.farms[myKey]) {
    myCornElement.textContent = gameState.farms[myKey].corn;
    console.log(`Updated corn count: ${gameState.farms[myKey].corn}`);
  }
}

// Update turn indicator
function updateTurnIndicator() {
  const isMyTurn = clientState.isMyTurn;
  const myColor = clientState.playerColor;
  const opponentColor = myColor === 'white' ? 'black' : 'white';
  
  console.log(`Updating turn indicator. My turn: ${isMyTurn}, My color: ${myColor}, Current game turn: ${gameState.currentTurn}`);
  
  // Update player headers
  const myHeader = document.getElementById('my-header');
  const opponentHeader = document.getElementById('opponent-header');
  
  if (myHeader && opponentHeader) {
    // First remove active class from both headers
    myHeader.classList.remove('active');
    opponentHeader.classList.remove('active');
    
    // Then add active class to the current player's header
    if (isMyTurn) {
      myHeader.classList.add('active');
    } else {
      opponentHeader.classList.add('active');
    }
    
    console.log(`Updated player headers: ${myColor} is ${isMyTurn ? 'active' : 'inactive'}, ${opponentColor} is ${!isMyTurn ? 'active' : 'inactive'}`);
  }
  
  // Update game status message
  const statusElement = document.getElementById('game-status');
  if (statusElement) {
    statusElement.textContent = isMyTurn ? 'Your turn' : 'Waiting for opponent';
    console.log(`Updated game status message: "${statusElement.textContent}"`);
  }
}

// Handle chess square click
function handleChessSquareClick(event) {
  console.log("Chess square clicked - Event details:", {
    eventTarget: event.target.className,
    currentTarget: event.currentTarget.className,
    dataset: event.currentTarget.dataset
  });

  if (!isMyTurn()) {
    console.log(`Not my turn (${clientState.playerColor}). Current turn: ${gameState.currentTurn}`);
    showMessage("It's not your turn!");
    return;
  }
  
  // Ensure we get the square element, not a child element like a piece
  const square = event.currentTarget;
  const row = parseInt(square.dataset.row);
  const col = parseInt(square.dataset.col);
  
  console.log(`Chess square clicked: row ${row}, col ${col}, id: ${square.id}`);
  
  // Get piece at this position
  const board = gameState.chessEngine.board();
  const piece = board[row][col];
  
  console.log(`Piece at clicked square:`, piece);
  
  // If no piece is selected and there's a piece of my color, select it
  if (!clientState.selectedPiece && piece && piece.color === clientState.playerColor.charAt(0)) {
    console.log(`Selecting piece ${piece.type} at ${row},${col} of color ${piece.color} (my color is ${clientState.playerColor})`);
    clientState.selectedPiece = { row, col, piece };
    square.classList.add('selected');
    displayValidMoves();
    return;
  }
  
  // If a piece is already selected
  if (clientState.selectedPiece) {
    // If clicking on another piece of my color, select that piece instead
    if (piece && piece.color === clientState.playerColor.charAt(0)) {
      console.log(`Changing selection to: ${piece.type} at row ${row}, col ${col}`);
      // Clear previous selection
      const prevSelectedSquare = document.getElementById(`square-${clientState.selectedPiece.row}-${clientState.selectedPiece.col}`);
      if (prevSelectedSquare) {
        prevSelectedSquare.classList.remove('selected');
      }
      
      // Clear previous valid move highlights
      document.querySelectorAll('.chess-square.valid-move, .chess-square.valid-capture').forEach(el => {
        el.classList.remove('valid-move', 'valid-capture');
      });
      
      // Update selection
      clientState.selectedPiece = { row, col, piece };
      square.classList.add('selected');
      displayValidMoves();
      return;
    }
    
    // Try to move the selected piece to this square
    const fromRow = clientState.selectedPiece.row;
    const fromCol = clientState.selectedPiece.col;
    
    // Get algebraic notations for the from and to squares
    const fromAlgebraic = algebraicPosition(fromRow, fromCol);
    const toAlgebraic = algebraicPosition(row, col);
    
    console.log(`Attempting to move from ${fromAlgebraic} to ${toAlgebraic}`);
    
    // Get valid moves from the chess engine
    const validMoves = gameState.chessEngine.moves({
      square: fromAlgebraic,
      verbose: true
    });
    
    // Log the valid moves for debugging
    console.log("Valid moves from chess engine:", validMoves.map(m => `${m.from}->${m.to}`));
    
    // Check if the destination square is a valid move
    const isValidMove = validMoves.some(move => move.to === toAlgebraic);
    
    console.log(`Attempting move from ${fromRow},${fromCol} to ${row},${col} - valid: ${isValidMove}`);
    
    if (isValidMove) {
      // Check if player has enough corn for this move
      const pieceType = clientState.selectedPiece.piece.type;
      const moveCost = gameState.config.moveCosts[pieceType];
      
      const myKey = clientState.playerColor === 'white' ? 'player1' : 'player2';
      const currentCorn = gameState.farms[myKey].corn;
      
      if (currentCorn >= moveCost) {
        // Make the move
        console.log(`Making move from ${fromAlgebraic} to ${toAlgebraic}`);
        
        const moveResult = gameState.chessEngine.move({
          from: fromAlgebraic,
          to: toAlgebraic,
          promotion: 'q' // Always promote to queen
        });
        
        if (moveResult) {
          console.log(`Move made: ${fromAlgebraic} to ${toAlgebraic}`, moveResult);
          
          // Check if it was a capture
          const isCapture = moveResult.captured ? true : false;
          
          // Update corn count
          const newCorn = currentCorn - moveCost;
          gameState.farms[myKey].corn = newCorn;
          
          // Validate chess engine state before sending
          const currentFen = gameState.chessEngine.fen();
          const boardPart = currentFen.split(' ')[0];
          if (boardPart === "8/8/8/8/8/8/8/8") {
            console.error("CRITICAL ERROR: Chess board is empty after move! Not sending this state to server");
            // Undo the move
            gameState.chessEngine.undo();
            showMessage("Error making move. Please try again.");
            // Reset selection
            clientState.selectedPiece = null;
            updateChessBoardDisplay();
            return;
          }
          
          // Store current state for potential recovery
          gameState.previousChessEngineState = currentFen;
          
          // Send move to server
          clientState.socket.emit('gameAction', {
            type: 'movePiece',
            chessEngineState: gameState.chessEngine.fen(),
            newCorn: newCorn,
            isCapture: isCapture
          });
          
          // Update UI
          updateChessBoardDisplay();
          updateCornCounts();
          
          // Check for checkmate or stalemate
          if (gameState.chessEngine.in_checkmate()) {
            showMessage(clientState.playerColor === 'white' ? 'Checkmate! You win!' : 'Checkmate! You lose!');
          } else if (gameState.chessEngine.in_stalemate()) {
            showMessage('Stalemate! The game is a draw.');
          } else if (gameState.chessEngine.in_check()) {
            showMessage(clientState.playerColor === gameState.chessEngine.turn() ? 'You are in check!' : 'Your opponent is in check!');
          }
          
          // End turn after a short delay to ensure the move is processed by the server
          setTimeout(() => {
            console.log(`Is still my turn before ending? ${isMyTurn()}, Player color: ${clientState.playerColor}`);
            endTurn();
          }, 800);
        } else {
          console.error(`Move failed from ${fromAlgebraic} to ${toAlgebraic}`);
          showMessage("Invalid move!");
        }
      } else {
        showMessage(`Not enough corn! You need ${moveCost} corn to move this piece.`);
      }
    } else {
      console.log(`Invalid move attempted`);
      showMessage("Invalid move!");
    }
    
    // Reset selection
    clientState.selectedPiece = null;
    // Remove all highlighting
    document.querySelectorAll('.chess-square.selected, .chess-square.valid-move, .chess-square.valid-capture').forEach(el => {
      el.classList.remove('selected', 'valid-move', 'valid-capture');
    });
  }
}

// Handle farm plot click
function handleFarmPlotClick(event) {
  if (!isMyTurn()) {
    console.log(`Not my turn (${clientState.playerColor}). Current turn: ${gameState.currentTurn}`);
    showMessage("It's not your turn!");
    return;
  }
  
  const plot = event.currentTarget;
  const plotIndex = parseInt(plot.dataset.index);
  const playerKey = plot.dataset.player;
  
  console.log(`Farm plot clicked: index ${plotIndex}, player ${playerKey}, color ${clientState.playerColor}`);
  
  // Check if this is my farm
  const isMyFarm = (playerKey === 'player1' && clientState.playerColor === 'white') || 
                   (playerKey === 'player2' && clientState.playerColor === 'black');
  
  if (!isMyFarm) {
    console.log('Cannot interact with opponent\'s farm');
    showMessage("You can only interact with your own farm!");
    return;
  }
  
  // Get plot data
  const plotData = gameState.farms[playerKey].plots[plotIndex];
  
  // Handle based on plot state
  switch (plotData.state) {
    case 'empty':
      // Show plant selector
      showPlantSelector(plotIndex, playerKey);
      break;
      
    case 'ready':
      // Harvest plant
      const plantType = plotData.plantType || 'corn'; // Default to corn for backward compatibility
      
      // Check if plant configuration exists
      if (!gameState.config || !gameState.config.farming || !gameState.config.farming.plants) {
        console.warn("Plant configuration missing in handleFarmPlotClick, restoring defaults");
        if (!gameState.config) gameState.config = {};
        if (!gameState.config.farming) gameState.config.farming = {};
        
        // Restore the default plant configuration
        gameState.config.farming.plants = {
          corn: { harvestYield: 10, emoji: "🌽" },
          wheat: { harvestYield: 6, emoji: "🌾" },
          carrot: { harvestYield: 12, emoji: "🥕" },
          potato: { harvestYield: 15, emoji: "🥔" }
        };
      }
      
      // Make sure the specific plant type exists
      if (!gameState.config.farming.plants[plantType]) {
        console.warn(`Plant type ${plantType} not found in config for harvesting, defaulting to corn`);
        plotData.plantType = 'corn';
      }
      
      const plant = gameState.config.farming.plants[plantType];
      
      // Default harvest yields for each plant type if undefined
      const defaultHarvestYields = {
        corn: 10,
        wheat: 6,
        carrot: 12,
        potato: 15
      };
      
      // Use plant.harvestYield if available, otherwise use default
      const harvestYield = plant.harvestYield !== undefined ? plant.harvestYield : defaultHarvestYields[plantType];
      
      // Update local state
      plotData.state = 'empty';
      plotData.plantType = null;
      plotData.growthStage = 0;
      gameState.farms[playerKey].corn += harvestYield;
      
      // Send action to server
      clientState.socket.emit('gameAction', {
        type: 'farmAction',
        farmAction: 'harvest',
        plotIndex: plotIndex,
        chessEngineState: gameState.chessEngine.fen()
      });
      
      // Update UI
      updatePlotDisplay(plot, plotData);
      updateCornCounts();
      
      console.log(`Harvested ${plantType} from plot ${plotIndex}. New corn: ${gameState.farms[playerKey].corn}`);
      showMessage(`Harvested ${plantType} for ${harvestYield} corn!`);
      
      // End turn after a short delay
      setTimeout(() => {
        console.log(`Is still my turn before ending? ${isMyTurn()}, Player color: ${clientState.playerColor}`);
        if (isMyTurn()) {
          endTurn();
        } else {
          console.warn("Not ending turn because it's no longer my turn");
        }
      }, 800);
      break;
      
    case 'unlockable':
      // Unlock plot if player has enough corn
      const unlockCost = gameState.config.farming.unlockCost;
      
      if (gameState.farms[playerKey].corn >= unlockCost) {
        // Update local state
        plotData.state = 'empty';
        gameState.farms[playerKey].corn -= unlockCost;
        gameState.farms[playerKey].unlocked++;
        gameState.farms[playerKey].unlockable--;
        
        // Send action to server
        clientState.socket.emit('gameAction', {
          type: 'farmAction',
          farmAction: 'unlock',
          plotIndex: plotIndex,
          chessEngineState: gameState.chessEngine.fen()
        });
        
        // Update UI
        updatePlotDisplay(plot, plotData);
        updateCornCounts();
        
        console.log(`Unlocked plot ${plotIndex}. New corn: ${gameState.farms[playerKey].corn}`);
        showMessage(`Unlocked plot for ${unlockCost} corn!`);
        
        // End turn after a short delay
        setTimeout(() => {
          console.log(`Is still my turn before ending? ${isMyTurn()}, Player color: ${clientState.playerColor}`);
          if (isMyTurn()) {
            endTurn();
          } else {
            console.warn("Not ending turn because it's no longer my turn");
          }
        }, 800);
      } else {
        showMessage(`Not enough corn! You need ${unlockCost} corn to unlock this plot.`);
      }
      break;
      
    default:
      console.log(`Cannot interact with plot in state: ${plotData.state}`);
      break;
  }
}

// Get valid moves for the selected piece
function getValidMoves() {
  if (!clientState.selectedPiece || !gameState.chessEngine) {
    console.log("No piece selected or chess engine not initialized");
    return [];
  }
  
  const { row, col, piece } = clientState.selectedPiece;
  const algebraic = algebraicPosition(row, col);
  
  console.log(`Getting valid moves for ${piece.type} at ${algebraic}`);
  
  // Debug logging to help diagnose the issue
  console.log(`Current FEN: ${gameState.chessEngine.fen()}`);
  console.log(`Current turn in chess engine: ${gameState.chessEngine.turn()}`);
  console.log(`Is player's turn in client state: ${clientState.isMyTurn}`);
  
  // Check for turn mismatch here and correct it before getting moves
  const chessEngineTurn = gameState.chessEngine.turn();
  const expectedTurn = clientState.playerColor === 'white' ? 'w' : 'b';
  
  if (clientState.isMyTurn && chessEngineTurn !== expectedTurn) {
    console.warn(`Turn mismatch in getValidMoves! Fixing before calculating moves.`);
    // Get the current position from the chess engine
    const position = gameState.chessEngine.fen();
    
    // Safely update just the turn portion
    const parts = position.split(' ');
    if (parts.length >= 2) {
      parts[1] = expectedTurn;
      const fixedFen = parts.join(' ');
      console.log(`Fixing FEN for move calculation: ${fixedFen}`);
      
      // Try with the fixed FEN
      try {
        const tempEngine = new Chess(fixedFen);
        const moves = tempEngine.moves({square: algebraic, verbose: true});
        console.log(`Possible moves from temp engine:`, moves);
        return moves;
      } catch (err) {
        console.error(`Error with temp engine, falling back to original:`, err);
      }
    }
  }
  
  // If no mismatch or the fix failed, use the main engine
  const possibleMoves = gameState.chessEngine.moves({square: algebraic, verbose: true});
  console.log(`Possible moves from chess.js:`, possibleMoves);
  
  // Filter out any invalid moves based on game rules
  // ... (existing filtering logic if any)
  
  console.log(`Found ${possibleMoves.length} valid moves for ${piece.type} at ${algebraic}`);
  return possibleMoves;
}

// Convert row/col to algebraic notation
function algebraicPosition(row, col) {
  const files = 'abcdefgh';
  const ranks = '87654321';
  
  // If playing as black and the board is visually flipped, adjust coordinates
  if (clientState.playerColor === 'black') {
    // Fixing the mapping for black player perspective
    return files[col] + ranks[row];
  } else {
    return files[col] + ranks[row];
  }
}

// Convert algebraic notation to row/col
function squareToCoordinates(square) {
  const files = 'abcdefgh';
  const ranks = '87654321';
  
  const col = files.indexOf(square[0]);
  const row = ranks.indexOf(square[1]);
  
  console.log(`Converting algebraic ${square} to row/col: ${row},${col}`);
  
  return { row, col };
}

// Reset selection state
function resetSelectionState() {
  clientState.selectedPiece = null;
  clientState.selectedPlot = null;
  updateChessBoardDisplay();
}

// Show a message to the user
function showMessage(message, duration = 3000) {
  const messageElement = document.getElementById('message');
  if (!messageElement) return;
  
  messageElement.textContent = message;
  messageElement.classList.add('visible');
  
  setTimeout(() => {
    messageElement.classList.remove('visible');
  }, duration);
}

// Show a screen by ID and hide others
function showScreen(screenId) {
  console.log(`Showing screen: ${screenId}`);
  
  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  
  // Show requested screen
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.remove('hidden');
    
    // If it's the game screen, make sure we update the room info
    if (screenId === 'game-screen') {
      updateRoomInfo();
    }
  }
}

// Check if it's the current player's turn
function isMyTurn() {
  // First check the client state flag
  if (clientState.isMyTurn !== undefined) {
    console.log(`Checking turn using clientState.isMyTurn: ${clientState.isMyTurn}, Player color: ${clientState.playerColor}`);
    
    // ADDED VALIDATION: Make sure chess engine state matches client state
    if (gameState.chessEngine) {
      const chessEngineTurn = gameState.chessEngine.turn();
      const expectedTurn = clientState.playerColor === 'white' ? 'w' : 'b';
      
      if ((chessEngineTurn === 'w' && clientState.playerColor === 'white' && clientState.isMyTurn) ||
          (chessEngineTurn === 'b' && clientState.playerColor === 'black' && clientState.isMyTurn)) {
        // All good, states match
        return clientState.isMyTurn;
      } else if (clientState.isMyTurn) {
        // There's a turn mismatch that needs to be fixed
        console.warn(`Turn state mismatch! Client thinks it's ${clientState.playerColor}'s turn but chess engine says it's ${chessEngineTurn === 'w' ? 'white' : 'black'}'s turn`);
        
        // Fix the chess engine turn
        const fen = gameState.chessEngine.fen();
        const fenParts = fen.split(' ');
        fenParts[1] = expectedTurn;
        const correctedFen = fenParts.join(' ');
        
        console.log(`Correcting chess engine state to: ${correctedFen}`);
        gameState.chessEngine = new Chess(correctedFen);
        gameState.chessEngineState = correctedFen;
        
        return true;
      }
    }
    
    return clientState.isMyTurn;
  }
  
  // Fall back to comparing player color with current turn
  const result = clientState.playerColor === gameState.currentTurn;
  console.log(`Checking turn by comparing colors: ${result}, Player color: ${clientState.playerColor}, Current turn: ${gameState.currentTurn}`);
  
  // Update the client state flag
  clientState.isMyTurn = result;
  
  return result;
}

// End the current player's turn
function endTurn() {
  if (!isMyTurn()) {
    console.log(`Cannot end turn - not my turn. Player color: ${clientState.playerColor}, Current turn: ${gameState.currentTurn}`);
    return;
  }
  
  console.log(`Ending turn for player ${clientState.playerId} (${clientState.playerColor})`);
  
  // Validate chess engine state before sending - prevent empty board
  const currentFen = gameState.chessEngine.fen();
  console.log(`Current chess engine state: ${currentFen}`);
  
  // Check if the board is empty (first part of FEN would be "8/8/8/8/8/8/8/8")
  const boardPart = currentFen.split(' ')[0];
  if (boardPart === "8/8/8/8/8/8/8/8") {
    console.error("CRITICAL ERROR: Chess board is empty! Not sending this state to server");
    
    // Try to restore from the previous state or reset to initial position
    if (gameState.previousChessEngineState) {
      console.log(`Restoring from previous state: ${gameState.previousChessEngineState}`);
      try {
        gameState.chessEngine = new Chess(gameState.previousChessEngineState);
        console.log(`Restored chess engine with FEN: ${gameState.chessEngine.fen()}`);
      } catch (e) {
        console.error("Failed to restore previous state, using default position");
        gameState.chessEngine = new Chess();
      }
    } else {
      console.log("No previous state available, using default position");
      gameState.chessEngine = new Chess();
    }
  } else {
    // Save current state as previous state for potential recovery
    gameState.previousChessEngineState = currentFen;
  }
  
  // Send end turn action to server
  clientState.socket.emit('gameAction', {
    type: 'endTurn',
    chessEngineState: gameState.chessEngine.fen()
  });
  
  // Update turn indicator immediately
  clientState.isMyTurn = false;
  updateTurnIndicator();
  
  console.log('Turn ended, waiting for opponent');
}

// Get the CSS class name for a piece
function getPieceName(piece) {
  if (!piece) return '';
  
  // If piece is a character from FEN notation
  if (typeof piece === 'string') {
    const pieceChar = piece.toLowerCase();
    switch (pieceChar) {
      case 'p': return 'pawn';
      case 'r': return 'rook';
      case 'n': return 'knight';
      case 'b': return 'bishop';
      case 'q': return 'queen';
      case 'k': return 'king';
      default: return '';
    }
  } 
  // If piece is an object from chess.js
  else if (piece && piece.type) {
    return piece.type;
  }
  
  return '';
}

// Show victory banner
function showVictoryBanner(isWinner, message) {
  // Display victory banner
  const victoryBanner = document.createElement('div');
  victoryBanner.className = 'victory-banner';
  victoryBanner.innerHTML = `
    <h2>${isWinner ? 'Victory!' : 'Defeat'}</h2>
    <p>${message}</p>
    <button id="new-game-btn">Play Again</button>
  `;
  document.body.appendChild(victoryBanner);
  
  // Add event listener to new game button
  document.getElementById('new-game-btn').addEventListener('click', () => {
    location.reload();
  });
}

// Update room info display in the game screen
function updateRoomInfo() {
  try {
    // Update room ID display
    const roomIdDisplays = document.querySelectorAll('#room-id-display');
    roomIdDisplays.forEach(elem => {
      if (elem) elem.textContent = clientState.roomId || 'Unknown';
    });
    
    // Update player color display
    const playerColorDisplays = document.querySelectorAll('#player-color');
    playerColorDisplays.forEach(elem => {
      if (elem) elem.textContent = clientState.playerColor || 'Unknown';
    });
    
    console.log(`Updated room info: Room ID: ${clientState.roomId}, Player Color: ${clientState.playerColor}`);
  } catch (error) {
    console.error('Error updating room info:', error);
  }
}

// Add a special debug function to help diagnose move problems
function debugValidMovesForSquare(row, col) {
    // Get the piece at the specified position
    const piece = getPieceAt(row, col);
    if (!piece) {
        console.log(`No piece at ${row},${col}`);
        return;
    }
    
    const squareAlgebraic = algebraicPosition(row, col);
    console.log(`Debugging valid moves for ${piece.type} at ${squareAlgebraic} (${row},${col})`);
    
    // Get valid moves from the chess engine
    try {
        if (!gameState.chessEngine) {
            console.error("Chess engine not initialized!");
            return;
        }
        
        // Get the raw moves from chess.js
        const moves = gameState.chessEngine.moves({
            square: squareAlgebraic,
            verbose: true
        });
        console.log(`Raw moves from chess.js:`, moves);
        
        // Test converting destinations back to grid coordinates
        moves.forEach(move => {
            const coords = squareToCoordinates(move.to);
            console.log(`Move to ${move.to} translates to grid [${coords.row},${coords.col}]`);
        });
        
        // Log the current FEN
        console.log(`Current FEN: ${gameState.chessEngine.fen()}`);
        
        // Check expected move d2-d4
        if (squareAlgebraic === 'd2') {
            const moveExists = moves.some(m => m.to === 'd4');
            console.log(`Can move from d2 to d4: ${moveExists}`);
            
            // Try manual move
            try {
                const moveResult = gameState.chessEngine.move({
                    from: 'd2',
                    to: 'd4'
                });
                console.log(`Manual move result:`, moveResult);
                // Undo the move to not affect the game
                gameState.chessEngine.undo();
            } catch (e) {
                console.error(`Manual move failed:`, e);
            }
        }
    } catch (e) {
        console.error(`Error debugging moves:`, e);
    }
} 