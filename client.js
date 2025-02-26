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
  selectedPlantType: 'corn', // Default selected plant type
  connected: false,
  connectionAttempts: 0
};

// Initialize the game when the page loads
function initialize() {
  console.log('Initializing game client...');
  
  try {
    // Hide all screens initially
    initializeScreens();
    
    // Set up event handlers for UI elements
    setupUIEventListeners();
    
    // Load chess.js library
    loadChessLibrary((success) => {
      console.log('Chess.js library loaded successfully');
      
      // Initialize Socket.io connection
      clientState.socket = setupSocketConnection();
      
      if (clientState.socket) {
        // Set up all socket event listeners
        setupSocketListeners(clientState.socket);
      } else {
        console.error('Failed to initialize socket');
        showMessage('Failed to connect to server. Please refresh the page.', 5000);
      }
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    showMessage('Error initializing game. Please refresh the page.', 5000);
  }
}

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

// Setup socket event listeners
function setupSocketListeners(socket) {
  // Handle player assignment
  socket.on('playerAssigned', (data) => {
    console.log('Player assigned event received:', data);
    
    // Store player information
    clientState.playerColor = data.color;
    clientState.roomId = data.roomId;
    clientState.playerId = socket.id;
    
    // Update the UI to show the player's color and room ID
    updateRoomInfo();
    
    // Show the waiting screen
    showScreen('waiting-screen');
    
    // Check if the element exists before trying to update it
    const waitingMessage = document.getElementById('waiting-message');
    if (waitingMessage) {
      waitingMessage.textContent = `You've joined room ${data.roomId} as ${data.color}. Waiting for opponent...`;
    } else {
      console.warn('Warning: waiting-message element not found in DOM');
    }
    
    showMessage(`Joined room ${data.roomId} as ${data.color}`, 3000);
  });
    
  // Handle room full notification
  socket.on('roomFull', (data) => {
    console.log('Room full event received:', data);
    showMessage(`Room ${data.roomId} is full. Try another room.`, 5000);
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
      
      // Show a message to the user
      showMessage('Connecting to game...', 10000); // Show for 10 seconds or until next message
      
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

// Initialize farm for specific player
function initializePlayerFarm(playerKey) {
  console.log(`Initializing farm for ${playerKey} with player color ${clientState.playerColor}`);
  
  // If playerKey is null, determine it from player color
  if (!playerKey) {
    if (clientState.playerColor === 'white') {
      playerKey = 'player1';
    } else if (clientState.playerColor === 'black') {
      playerKey = 'player2';
    } else {
      console.error(`Cannot initialize farm: Invalid player color: ${clientState.playerColor}`);
      return;
    }
    console.log(`Determined playerKey as ${playerKey} based on color ${clientState.playerColor}`);
  } else {
    // Validate that the provided playerKey matches the player's color
    const expectedKey = clientState.playerColor === 'white' ? 'player1' : 'player2';
    if (playerKey !== expectedKey) {
      console.warn(`Provided playerKey ${playerKey} doesn't match player color ${clientState.playerColor}. Using ${expectedKey} instead.`);
      playerKey = expectedKey;
    }
  }
  
  // Make sure farm container exists
  const farmContainer = document.getElementById(`${playerKey}-farm`);
  if (!farmContainer) {
    console.error(`Farm container for ${playerKey} not found`);
    return;
  }
  
  // Clear existing farm
  farmContainer.innerHTML = '';
  
  // Make sure the game state and farm data exist
  if (!gameState || !gameState.farms || !gameState.farms[playerKey]) {
    console.error(`Game state or farm data for ${playerKey} not found`);
    return;
  }
  
  const farmData = gameState.farms[playerKey];
  const numPlots = farmData.plots.length;
  
  console.log(`Initializing farm for ${playerKey} with ${numPlots} plots`);
  
  // Create farm plots
  for (let i = 0; i < numPlots; i++) {
    const plotData = farmData.plots[i];
    const plotElement = document.createElement('div');
    plotElement.className = 'farm-plot';
    plotElement.dataset.index = i;
    plotElement.dataset.player = playerKey;
    
    // Update plot appearance based on state
    updatePlotDisplay(plotElement, plotData);
    
    // Add click event listener if it's the player's farm
    const isMyFarm = (playerKey === 'player1' && clientState.playerColor === 'white') || 
                      (playerKey === 'player2' && clientState.playerColor === 'black');
                      
    if (isMyFarm) {
      plotElement.addEventListener('click', handleFarmPlotClick);
    }
    
    farmContainer.appendChild(plotElement);
  }
  
  console.log(`Farm initialized with ${numPlots} plots`);
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
  // Clear any existing valid move indicators
  document.querySelectorAll('.chess-square.valid-move, .chess-square.valid-capture').forEach(square => {
    square.classList.remove('valid-move', 'valid-capture');
  });

  if (!clientState.selectedPiece || !gameState.chessEngine) {
    return;
  }

  // Get valid moves from the chess engine
  const validMoves = getValidMoves();

  // Highlight valid move squares
  validMoves.forEach(move => {
    const coords = squareToCoordinates(move.to);
    const square = document.getElementById(`square-${coords.row}-${coords.col}`);
    
    if (square) {
      if (move.captured) {
        square.classList.add('valid-capture');
      } else {
        square.classList.add('valid-move');
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
    
    // Save current chess engine state for potential recovery
    gameState.previousChessEngineState = gameState.chessEngine.fen();
    
    // Properly update chess engine turn to match the new turn after this action
    const currentFen = gameState.chessEngine.fen();
    const fenParts = currentFen.split(' ');
    const currentChessTurn = fenParts[1]; // 'w' or 'b'
    
    // Since this farm action will end the turn, we need to flip the chess engine turn as well
    const nextChessTurn = currentChessTurn === 'w' ? 'b' : 'w';
    fenParts[1] = nextChessTurn;
    const updatedFen = fenParts.join(' ');
    
    try {
      // Validate the FEN is still valid
      const tempEngine = new Chess(updatedFen);
      if (tempEngine.validate_fen(updatedFen).valid) {
        gameState.chessEngine = tempEngine;
        gameState.chessEngineState = updatedFen;
        console.log(`Updated chess engine turn for farm action: ${updatedFen}`);
      }
    } catch (e) {
      console.error(`Error updating chess turn: ${e}`);
    }
    
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
  if (!gameState || !gameState.farms) {
    console.log("Cannot update corn counts - game state or farms not initialized");
    return;
  }
  
  // Update player 1 (white) corn count
  const player1Corn = document.getElementById('player1-corn');
  if (player1Corn && gameState.farms.player1) {
    player1Corn.textContent = gameState.farms.player1.corn;
  }
  
  // Update player 2 (black) corn count
  const player2Corn = document.getElementById('player2-corn');
  if (player2Corn && gameState.farms.player2) {
    player2Corn.textContent = gameState.farms.player2.corn;
  }
  
  console.log(`Updated corn count: White: ${gameState.farms.player1?.corn}, Black: ${gameState.farms.player2?.corn}`);
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
  if (!gameState.chessEngine || !isMyTurn()) {
    return;
  }

  const square = event.target.closest('.chess-square');
  if (!square) return;

  const row = parseInt(square.dataset.row);
  const col = parseInt(square.dataset.col);
  const position = algebraicPosition(row, col);

  // If a piece is already selected, try to move it
  if (clientState.selectedPiece) {
    const from = clientState.selectedPiece;

    // Save current state before making the move (for potential recovery)
    const currentState = gameState.chessEngine.fen();
    gameState.previousChessEngineState = currentState;
    
    console.log(`Attempting move from ${from} to ${position}`);
    
    // Check if this is a valid move
    const validMoves = getValidMoves();
    console.log("Valid moves:", validMoves);
    const moveToMake = validMoves.find(move => move.from === from && move.to === position);
    
    if (moveToMake) {
      // Try to make the move
      try {
        const move = gameState.chessEngine.move({
          from: from,
          to: position,
          promotion: 'q' // Always promote to queen for simplicity
        });
        
        // Check if the move was successful
        if (move) {
          console.log(`Move successful: ${from} to ${position}`, move);
          
          // Validate the chess state after the move
          const newState = gameState.chessEngine.fen();
          const boardPart = newState.split(' ')[0];
          
          if (boardPart === "8/8/8/8/8/8/8/8") {
            console.error("ERROR: Move resulted in empty board! Undoing move.");
            gameState.chessEngine = new Chess(currentState);
            resetSelectionState();
            showMessage("Invalid move detected. Please try again.");
            return;
          }
          
          // Check if the move was a capture
          const isCapture = move.captured ? true : false;
          
          // Update corn for the move cost - just use a fixed cost instead of piece-specific cost for simplicity
          const moveCost = isCapture ? 10 : 5;
          
          // Update the player's corn count
          const playerKey = clientState.playerColor === 'white' ? 'player1' : 'player2';
          gameState.farms[playerKey].corn -= moveCost;
          
          // Store the current chess state for recovery
          gameState.previousChessEngineState = newState;
          
          // Send the move to the server
          // Keep the chess engine turn as is - the server will handle the turn switching
          console.log(`Sending chess move to server. New FEN: ${newState}`);
          clientState.socket.emit('gameAction', {
            type: 'movePiece',
            from: from,
            to: position,
            isCapture: isCapture,
            chessEngineState: newState
          });
          
          // Reset selection state
          resetSelectionState();
          
          // Update the UI
          updateChessBoardDisplay();
          updateCornCounts();
          
          // Show capture message if applicable
          if (isCapture) {
            showMessage(`Captured a piece! +5 corn cost for capture.`);
          }
          
          // Auto-end turn after a short delay
          setTimeout(() => {
            if (isMyTurn()) {
              endTurn();
            }
          }, 1000);
        } else {
          console.error("Move failed");
          resetSelectionState();
        }
      } catch (error) {
        console.error("Error making move:", error);
        
        // Restore the previous state if there was an error
        if (gameState.previousChessEngineState) {
          try {
            gameState.chessEngine = new Chess(gameState.previousChessEngineState);
            console.log(`Restored chess engine state after error: ${gameState.chessEngine.fen()}`);
          } catch (e) {
            console.error("Failed to restore previous state:", e);
          }
        }
        
        resetSelectionState();
        showMessage("Invalid move. Please try again.");
      }
    } else {
      console.log("Invalid move - not in the list of valid moves");
      resetSelectionState();
      
      // If clicking on own piece, select it instead
      const piece = gameState.chessEngine.get(position);
      if (piece && ((piece.color === 'w' && clientState.playerColor === 'white') || 
                   (piece.color === 'b' && clientState.playerColor === 'black'))) {
        clientState.selectedPiece = position;
        displayValidMoves();
        
        // Add selected class to the square
        square.classList.add('selected');
      }
    }
  } else {
    // If no piece is selected, try to select one
    const piece = gameState.chessEngine.get(position);
    
    // Only allow selecting pieces that belong to the current player
    if (piece && ((piece.color === 'w' && clientState.playerColor === 'white') || 
                 (piece.color === 'b' && clientState.playerColor === 'black'))) {
      clientState.selectedPiece = position;
      displayValidMoves();
      
      // Add selected class to the square
      square.classList.add('selected');
    }
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
    return [];
  }
  
  try {
    // Get valid moves from the chess engine
    const from = clientState.selectedPiece;
    const validMoves = gameState.chessEngine.moves({
      square: from,
      verbose: true
    });
    
    console.log(`Valid moves for piece at ${from}:`, validMoves.map(m => `${m.from}->${m.to}`));
    return validMoves;
  } catch (error) {
    console.error("Error getting valid moves:", error);
    return [];
  }
}

// Convert row/col to algebraic notation (e.g., "e4")
function algebraicPosition(row, col) {
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = 8 - row;
  return file + rank;
}

// Convert algebraic notation to row/col
function squareToCoordinates(square) {
  const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = 8 - parseInt(square.charAt(1));
  return { row, col };
}

// Reset selection state
function resetSelectionState() {
  // Clear piece selection
  clientState.selectedPiece = null;
  
  // Remove all selection and move highlighting classes
  document.querySelectorAll('.chess-square.selected, .chess-square.valid-move, .chess-square.valid-capture').forEach(el => {
    el.classList.remove('selected', 'valid-move', 'valid-capture');
  });
  
  console.log("Selection state reset");
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
  // First check if we have been assigned a color
  if (!clientState.playerColor) {
    console.log("Player color not assigned yet");
    return false;
  }
  
  // Check if we're in a game
  if (!gameState.currentTurn) {
    console.log("Game not started yet");
    return false;
  }
  
  // Use the client-side turn state (set by the server)
  const serverTurn = gameState.currentTurn;
  const isMyTurnBasedOnServer = clientState.playerColor === serverTurn;
  
  // For debugging, check if there's a mismatch between server and chess engine
  if (gameState.chessEngine) {
    const chessEngineTurn = gameState.chessEngine.turn();
    const playerColorInEngine = clientState.playerColor === 'white' ? 'w' : 'b';
    const expectedEngineTurn = serverTurn === 'white' ? 'w' : 'b';
    
    if (chessEngineTurn !== expectedEngineTurn) {
      console.log(`Turn state mismatch! Client thinks it's ${serverTurn}'s turn but chess engine says it's ${chessEngineTurn === 'w' ? 'white' : 'black'}'s turn`);
      
      // Don't automatically fix here, let the gameStateUpdate handler fix it
      // Just return whether it's the player's turn based on the server state
    }
  }
  
  // Use the server's turn state as the source of truth
  return isMyTurnBasedOnServer;
}

// End the current player's turn
function endTurn() {
  console.log(`endTurn called, is my turn: ${isMyTurn()}`);
  
  // Verify it's actually the user's turn
  if (!isMyTurn()) {
    console.warn("Tried to end turn when it's not the player's turn");
    return;
  }
  
  // Save current chess engine state before ending turn for recovery if needed
  const originalChessState = gameState.chessEngine.fen();
  console.log(`Current chess engine state before ending turn: ${originalChessState}`);
  
  // Validate that we're not sending an empty board state
  const boardPart = originalChessState.split(' ')[0];
  if (boardPart === "8/8/8/8/8/8/8/8") {
    console.error("Cannot end turn with an empty board state!");
    
    // Try to recover from a previous state if available
    if (gameState.previousChessEngineState) {
      try {
        console.log(`Attempting to recover from previous state: ${gameState.previousChessEngineState}`);
        
        // Keep the previous pieces but update the turn to match current turn
        const prevParts = gameState.previousChessEngineState.split(' ');
        const currentTurn = gameState.chessEngine.turn();
        prevParts[1] = currentTurn;
        const recoveredFen = prevParts.join(' ');
        
        // Validate this is a valid FEN
        const testEngine = new Chess(recoveredFen);
        if (testEngine.validate_fen(recoveredFen).valid) {
          gameState.chessEngine = testEngine;
          gameState.chessEngineState = recoveredFen;
          console.log(`Successfully recovered chess engine state: ${recoveredFen}`);
        } else {
          throw new Error("Invalid recovered FEN");
        }
      } catch (err) {
        console.error(`Recovery failed: ${err}`);
        showMessage("Error: Unable to end turn with current game state. Please restart the game.");
        return;
      }
    } else {
      showMessage("Error: Cannot end turn with empty board. Please restart the game.");
      return;
    }
  }
  
  // Determine the next turn and update the client-side chess engine
  const currentTurn = gameState.chessEngine.turn();
  const nextTurn = currentTurn === 'w' ? 'b' : 'w';
  
  try {
    // Update the local chess engine's turn before sending to server
    const fenParts = gameState.chessEngine.fen().split(' ');
    fenParts[1] = nextTurn;
    const updatedFen = fenParts.join(' ');
    
    // Validate the updated FEN
    if (new Chess().validate_fen(updatedFen).valid) {
      gameState.chessEngineState = updatedFen;
      console.log(`Updated local chess engine state for turn end: ${updatedFen}`);
    }
  } catch (e) {
    console.warn(`Failed to update local chess turn: ${e}`);
    // Continue anyway, the server will handle it
  }
  
  // Emit the end turn event
  clientState.socket.emit('gameAction', {
    type: 'endTurn',
    chessEngineState: gameState.chessEngine.fen()
  });
  
  console.log("Turn ended");
  
  // Disable board interaction until server confirms
  clientState.isMyTurn = false;
  updateTurnIndicator();
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
  // Update room ID
  const roomIdDisplay = document.getElementById('room-id-display');
  if (roomIdDisplay) {
    roomIdDisplay.textContent = clientState.roomId || 'None';
  }
  
  // Update player color
  const playerColorDisplay = document.getElementById('player-color');
  if (playerColorDisplay) {
    playerColorDisplay.textContent = clientState.playerColor || 'Not assigned';
    
    // Update color indicator
    if (clientState.playerColor === 'white') {
      playerColorDisplay.classList.add('white-player');
      playerColorDisplay.classList.remove('black-player');
    } else if (clientState.playerColor === 'black') {
      playerColorDisplay.classList.add('black-player');
      playerColorDisplay.classList.remove('white-player');
    }
  }
  
  // Highlight the player's farm header
  const player1Header = document.getElementById('player1-header');
  const player2Header = document.getElementById('player2-header');
  
  if (player1Header && player2Header) {
    if (clientState.playerColor === 'white') {
      player1Header.classList.add('my-farm-header');
      player2Header.classList.remove('my-farm-header');
    } else if (clientState.playerColor === 'black') {
      player2Header.classList.add('my-farm-header');
      player1Header.classList.remove('my-farm-header');
    }
  }
  
  console.log(`Room info updated: Room ${clientState.roomId}, Player color: ${clientState.playerColor}`);
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

// Handle harvest action
function handleHarvestAction(index, playerKey) {
  console.log(`handleHarvestAction called: index=${index}, playerKey=${playerKey}`);
  
  if (!isMyTurn()) {
    console.log("Not my turn, cannot harvest");
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
  
  if (plotData.state !== 'ready') {
    console.error(`Cannot harvest plot that is not ready, state: ${plotData.state}`);
    return;
  }
  
  const plantType = plotData.plantType || 'corn'; // Default to corn for backward compatibility
  
  // Check if plant configuration exists
  if (!gameState.config || !gameState.config.farming || !gameState.config.farming.plants) {
    console.warn("Plant configuration missing in handleHarvestAction, restoring defaults");
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
  
  // Save current chess engine state for potential recovery
  gameState.previousChessEngineState = gameState.chessEngine.fen();
  
  // Properly update chess engine turn to match the new turn after this action
  const currentFen = gameState.chessEngine.fen();
  const fenParts = currentFen.split(' ');
  const currentChessTurn = fenParts[1]; // 'w' or 'b'
  
  // Since this farm action will end the turn, we need to flip the chess engine turn as well
  const nextChessTurn = currentChessTurn === 'w' ? 'b' : 'w';
  fenParts[1] = nextChessTurn;
  const updatedFen = fenParts.join(' ');
  
  try {
    // Validate the FEN is still valid
    const tempEngine = new Chess(updatedFen);
    if (tempEngine.validate_fen(updatedFen).valid) {
      gameState.chessEngine = tempEngine;
      gameState.chessEngineState = updatedFen;
      console.log(`Updated chess engine turn for harvest action: ${updatedFen}`);
    }
  } catch (e) {
    console.error(`Error updating chess turn: ${e}`);
  }
  
  // Send action to server
  clientState.socket.emit('gameAction', {
    type: 'farmAction',
    farmAction: 'harvest',
    plotIndex: index,
    chessEngineState: gameState.chessEngine.fen()
  });
  
  // Update UI
  const plot = document.querySelector(`.farm-plot[data-index="${index}"][data-player="${playerKeyMapped}"]`);
  if (plot) {
    updatePlotDisplay(plot, plotData);
  }
  updateCornCounts();
  
  console.log(`Harvested ${plantType} from plot ${index}. New corn: ${gameState.farms[playerKey].corn}`);
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
}

// Handle unlock action
function handleUnlockAction(index, playerKey) {
  console.log(`handleUnlockAction called: index=${index}, playerKey=${playerKey}`);
  
  if (!isMyTurn()) {
    console.log("Not my turn, cannot unlock");
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
  
  // Check if plot is unlockable
  if (plotData.state !== 'unlockable') {
    console.error(`Cannot unlock plot that is not unlockable, state: ${plotData.state}`);
    return;
  }
  
  // Check if player has enough corn
  const unlockCost = gameState.config.farming.unlockCost;
  
  if (gameState.farms[playerKeyMapped].corn >= unlockCost) {
    // Update local state
    plotData.state = 'empty';
    gameState.farms[playerKeyMapped].corn -= unlockCost;
    gameState.farms[playerKeyMapped].unlocked++;
    gameState.farms[playerKeyMapped].unlockable--;
    
    // Save current chess engine state for potential recovery
    gameState.previousChessEngineState = gameState.chessEngine.fen();
    
    // Properly update chess engine turn to match the new turn after this action
    const currentFen = gameState.chessEngine.fen();
    const fenParts = currentFen.split(' ');
    const currentChessTurn = fenParts[1]; // 'w' or 'b'
    
    // Since this farm action will end the turn, we need to flip the chess engine turn as well
    const nextChessTurn = currentChessTurn === 'w' ? 'b' : 'w';
    fenParts[1] = nextChessTurn;
    const updatedFen = fenParts.join(' ');
    
    try {
      // Validate the FEN is still valid
      const tempEngine = new Chess(updatedFen);
      if (tempEngine.validate_fen(updatedFen).valid) {
        gameState.chessEngine = tempEngine;
        gameState.chessEngineState = updatedFen;
        console.log(`Updated chess engine turn for unlock action: ${updatedFen}`);
      }
    } catch (e) {
      console.error(`Error updating chess turn: ${e}`);
    }
    
    // Send action to server
    clientState.socket.emit('gameAction', {
      type: 'farmAction',
      farmAction: 'unlock',
      plotIndex: index,
      chessEngineState: gameState.chessEngine.fen()
    });
    
    // Update UI
    const plot = document.querySelector(`.farm-plot[data-index="${index}"][data-player="${playerKeyMapped}"]`);
    if (plot) {
      updatePlotDisplay(plot, plotData);
    }
    updateCornCounts();
    
    console.log(`Unlocked plot ${index}. New corn: ${gameState.farms[playerKey].corn}`);
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
}

// Setup socket connection
function setupSocketConnection() {
  try {
    console.log('Setting up socket connection');
    // Create socket connection
    const socket = io();
    
    // Store socket in client state
    clientState.socket = socket;
    clientState.connectionAttempts = 0;
    
    // Socket connection event handlers
    socket.on('connect', () => {
      console.log('Connected to server with socket ID:', socket.id);
      clientState.connected = true;
      clientState.connectionAttempts = 0;
      clientState.playerId = socket.id;
      
      showMessage('Connected to server', 2000);
      
      // If we have a saved room ID, try to rejoin on reconnection
      if (clientState.roomId) {
        console.log(`Attempting to rejoin room ${clientState.roomId} after reconnect`);
        
        // Emit joinGame event with roomId
        socket.emit('joinGame', { roomId: clientState.roomId });
        showMessage(`Reconnecting to game ${clientState.roomId}...`, 3000);
      }
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      clientState.connected = false;
      clientState.connectionAttempts++;
      
      if (clientState.connectionAttempts <= 3) {
        showMessage(`Connection error: ${error.message}. Retrying...`, 3000);
      } else {
        showMessage(`Unable to connect to server after ${clientState.connectionAttempts} attempts. Please check your connection.`, 5000);
      }
    });
    
    // Handle disconnections
    socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      clientState.connected = false;
      
      if (reason === 'io server disconnect') {
        // The server has forcefully disconnected the socket
        showMessage('Disconnected by server. Attempting to reconnect...', 3000);
        socket.connect();
      } else {
        // Other disconnection reasons (transport close, etc.)
        showMessage('Connection lost. Attempting to reconnect...', 3000);
      }
    });
    
    // Handle reconnection
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      showMessage('Reconnected to server', 2000);
      
      // If we were in a game, try to rejoin
      if (clientState.roomId) {
        console.log(`Attempting to rejoin room ${clientState.roomId} after reconnect`);
        socket.emit('joinGame', { roomId: clientState.roomId });
        showMessage(`Reconnecting to game ${clientState.roomId}...`, 3000);
      }
    });
    
    // Handle reconnection error
    socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      showMessage(`Reconnection error: ${error.message}`, 3000);
    });
    
    // Handle reconnection failed
    socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect');
      showMessage('Failed to reconnect to server. Please refresh the page.', 5000);
    });
    
    return socket;
  } catch (error) {
    console.error('Error setting up socket connection:', error);
    showMessage('Error connecting to server. Please refresh the page.', 5000);
    return null;
  }
}

// Add event listener for DOMContentLoaded to start the initialization process
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, starting game initialization...');
  initialize();
}); 