// Global variables
let socket;
let board = null;
let game = null;
let playerColor = 'white'; // Default
let currentTurn = 'white'; // Game starts with white
let roomId = null;
let username = '';
let isGameActive = false;
let currentPhase = 'chess'; // Current game phase: 'chess' or 'farming'
let wheatCount = 100; // Starting wheat amount

// DOM elements
const screens = {
  login: document.getElementById('login-screen'),
  waiting: document.getElementById('waiting-screen'),
  game: document.getElementById('game-screen')
};

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
  // Setup event listeners
  document.getElementById('join-game-btn').addEventListener('click', joinGame);
  
  // Initialize socket connection
  socket = io();
  setupSocketListeners();
});

// Setup all socket event listeners
function setupSocketListeners() {
  // Connection events
  socket.on('connect', () => {
    console.log('Connected to server');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showMessage('Connection lost. Please refresh the page.', 'error');
  });
  
  // Game events
  socket.on('playerAssigned', handleRoomJoined);
  socket.on('gameStart', handleGameStart);
  socket.on('chess-move', handleOpponentMove);
  socket.on('your-turn', handleYourTurn);
  socket.on('game-over', handleGameOver);
  socket.on('opponent-disconnected', handleOpponentDisconnected);
  socket.on('opponentLeft', handleOpponentDisconnected);
  socket.on('error', handleErrorMessage);
  socket.on('roomFull', (data) => {
    showMessage(`Room ${data.roomId} is full. Please try another room.`, 'error');
  });
  socket.on('gameStateUpdate', (data) => {
    console.log('Game state update received:', data);
    
    // Update local turn state if provided
    if (data.currentTurn) {
      currentTurn = data.currentTurn;
      updateTurnIndicator();
    }
    
    // Update chess board if there's chess state
    if (data.gameState && data.gameState.chessEngineState && game) {
      game.load(data.gameState.chessEngineState);
      board.position(game.fen());
      checkGameStatus();
    }
  });
}

// Handle joining a game room
function joinGame() {
  username = document.getElementById('username').value.trim();
  const roomInput = document.getElementById('room-id').value.trim();
  
  if (!username) {
    alert('Please enter your name');
    return;
  }
  
  // Join or create a room
  socket.emit('joinGame', { 
    username: username,
    roomId: roomInput || null // If no room ID is provided, create a new room
  });
}

// Handle room joined event
function handleRoomJoined(data) {
  roomId = data.roomId;
  playerColor = data.color;
  
  // Update UI
  document.getElementById('room-code-display').textContent = roomId;
  document.getElementById('room-id-display').textContent = roomId;
  
  // Show waiting screen
  showScreen('waiting');
  
  console.log(`Joined room: ${roomId} as ${username} with color ${playerColor}`);
}

// Handle game start event
function handleGameStart(data) {
  console.log('Game start received:', data);
  playerColor = data.playerColor || playerColor;
  isGameActive = true;
  
  // Update UI
  document.getElementById('player-color').textContent = 
    playerColor.charAt(0).toUpperCase() + playerColor.slice(1);
  
  // Initialize chess game
  setupChessGame();
  
  // Show game screen and setup game UI
  showScreen('game');
  setupGameUI();
  
  // Update turn indicator
  if (data.currentTurn) {
    currentTurn = data.currentTurn;
  }
  updateTurnIndicator();
  
  showMessage(`Game started! You are playing as ${playerColor}.`);
}

// Handle opponent move event
function handleOpponentMove(data) {
  console.log('Opponent move received:', data);
  
  // Make the move on the board
  if (game && data.move) {
    game.move(data.move);
    board.position(game.fen());
  } else if (game && data.fen) {
    // Alternative: directly set the FEN if move object is not provided
    game.load(data.fen);
    board.position(game.fen());
  }
  
  // Update turn if not already handled by gameStateUpdate
  currentTurn = playerColor;
  updateTurnIndicator();
  
  playMoveSound();
  checkGameStatus();
}

// Handle your turn event
function handleYourTurn() {
  currentTurn = playerColor;
  updateTurnIndicator();
  showMessage("It's your turn!");
}

// Handle game over event
function handleGameOver(data) {
  isGameActive = false;
  
  let message;
  if (data.draw) {
    message = "Game ended in a draw!";
  } else if (data.winner === playerColor) {
    message = "You won the game!";
  } else {
    message = "You lost the game.";
  }
  
  showMessage(message, 'important');
  document.getElementById('game-status').textContent = message;
}

// Handle opponent disconnected event
function handleOpponentDisconnected() {
  showMessage('Your opponent has disconnected.', 'error');
  document.getElementById('game-status').textContent = 'Opponent disconnected';
}

// Handle error messages from server
function handleErrorMessage(data) {
  showMessage(data.message, 'error');
}

// Setup the chess game board and engine
function setupChessGame() {
  // Initialize the chess.js engine
  game = new Chess();
  
  // Configure the board position
  const config = {
    draggable: true,
    position: 'start',
    orientation: playerColor,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
  };
  
  // Initialize the chessboard
  board = Chessboard('chess-board', config);
  
  // Handle responsive board
  window.addEventListener('resize', board.resize);
}

// Chess move validation - only allow moves on player's turn
function onDragStart(source, piece) {
  // Do not allow moves if the game is over
  if (game.game_over() || !isGameActive) return false;
  
  // Only allow the current player to move their pieces
  if (currentTurn !== playerColor) return false;
  
  // Only allow the correct color piece to be moved
  if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
      (playerColor === 'black' && piece.search(/^w/) !== -1)) {
    return false;
  }
  
  return true;
}

// Handle piece drop and move validation
function onDrop(source, target) {
  // Check if we're in chess phase
  if (currentPhase !== 'chess') {
    showMessage('You must be in chess phase to move pieces.', 'error');
    return 'snapback';
  }
  
  // See if the move is legal
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Always promote to a queen for simplicity
  });
  
  // If illegal move, snap the piece back
  if (move === null) return 'snapback';
  
  // Check if player has enough wheat for this move
  const moveCost = getMoveCost(move.piece);
  
  if (wheatCount < moveCost) {
    // Not enough wheat, reverse the move
    game.undo();
    showMessage(`Not enough wheat. This move costs ${moveCost} wheat.`, 'error');
    return 'snapback';
  }
  
  // Deduct wheat cost
  wheatCount -= moveCost;
  updateWheatDisplay();
  
  // Check if move was a capture
  if (move.captured) {
    const captureBonus = 5; // Bonus wheat for capturing a piece
    wheatCount += captureBonus;
    updateWheatDisplay();
    showMessage(`Captured a piece! +${captureBonus} wheat`, 'success');
  }
  
  // Send the move to the server
  sendMove(move);
  
  // Update turn
  currentTurn = (playerColor === 'white') ? 'black' : 'white';
  updateTurnIndicator();
  
  playMoveSound();
  checkGameStatus();
}

// Get the wheat cost for moving a piece
function getMoveCost(piece) {
  // Convert to lowercase to ignore color
  const pieceType = piece.toLowerCase();
  
  switch (pieceType) {
    case 'p': return 1; // Pawn
    case 'r': return 5; // Rook
    case 'n': return 3; // Knight
    case 'b': return 3; // Bishop
    case 'q': return 9; // Queen
    case 'k': return 0; // King (free to move)
    default: return 1;
  }
}

// Update the board position after a move
function onSnapEnd() {
  board.position(game.fen());
}

// Send a move to the server
function sendMove(move) {
  socket.emit('chess-move', {
    roomId: roomId,
    move: move,
    fen: game.fen()
  });
  
  console.log('Move sent to server:', move, game.fen());
}

// Check if the game is over after a move
function checkGameStatus() {
  let gameStatus = '';
  
  if (game.in_checkmate()) {
    const winner = (game.turn() === 'w') ? 'black' : 'white';
    gameStatus = (winner === playerColor) ? 
      'Checkmate! You won!' : 
      'Checkmate! You lost.';
    
    socket.emit('game-over', {
      roomId: roomId,
      winner: winner
    });
  } 
  else if (game.in_draw()) {
    gameStatus = 'Game ended in a draw!';
    
    socket.emit('game-over', {
      roomId: roomId,
      draw: true
    });
  }
  else if (game.in_check()) {
    gameStatus = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)} is in check`;
  }
  
  if (gameStatus) {
    document.getElementById('game-status').textContent = gameStatus;
  }
}

// Show a message in the message box
function showMessage(message, type = 'info') {
  const messageDisplay = document.getElementById('message-display');
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  
  // Add class based on message type
  messageElement.className = `message ${type}`;
  
  // Clear old messages if there are too many
  if (messageDisplay.children.length > 5) {
    messageDisplay.removeChild(messageDisplay.firstChild);
  }
  
  messageDisplay.appendChild(messageElement);
  messageDisplay.scrollTop = messageDisplay.scrollHeight;
}

// Update the turn indicator
function updateTurnIndicator() {
  const turnIndicator = document.getElementById('turn-indicator');
  const currentTurnDisplay = currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1);
  
  turnIndicator.textContent = `Current Turn: ${currentTurnDisplay}`;
  
  if (currentTurn === playerColor) {
    turnIndicator.classList.add('turn-active');
    turnIndicator.classList.remove('turn-inactive');
  } else {
    turnIndicator.classList.add('turn-inactive');
    turnIndicator.classList.remove('turn-active');
  }
}

// Play sound when a move is made (placeholder - no actual sound implementation)
function playMoveSound() {
  // This would play a sound if implemented
  console.log('Move sound played');
}

// Helper function to show the correct screen
function showScreen(screenName) {
  Object.keys(screens).forEach(key => {
    screens[key].style.display = key === screenName ? 'block' : 'none';
  });
  
  // If showing game screen, make sure the chess board is sized correctly
  if (screenName === 'game' && board) {
    setTimeout(() => board.resize(), 100);
  }
}

// Add an end turn function
function endTurn() {
  socket.emit('end-turn', {
    roomId: roomId,
    chessEngineState: game ? game.fen() : null
  });
  
  console.log('End turn sent to server');
}

// Setup game UI after DOM is fully loaded
function setupGameUI() {
  // Add event listeners for game controls
  document.getElementById('end-turn-btn').addEventListener('click', endTurn);
  document.getElementById('toggle-phase-btn').addEventListener('click', toggleGamePhase);
  
  // Initialize farm plots
  setupFarmPlots();
  
  // Update UI with initial values
  updateWheatDisplay();
  updatePhaseDisplay();
}

// Setup farm plots in the UI
function setupFarmPlots() {
  const farmPlotsContainer = document.getElementById('farm-plots');
  farmPlotsContainer.innerHTML = ''; // Clear existing plots
  
  // Create 4 initial farm plots (2 active, 2 locked)
  for (let i = 0; i < 4; i++) {
    const plot = document.createElement('div');
    plot.className = i < 2 ? 'farm-plot' : 'farm-plot locked';
    plot.dataset.plotIndex = i;
    
    const plotText = document.createElement('div');
    plotText.className = 'farm-plot-text';
    
    if (i < 2) {
      plotText.textContent = 'Plant';
      plot.addEventListener('click', () => handleFarmPlotClick(i));
    } else {
      plotText.textContent = `Locked\nNeed ${i + 1} captures`;
    }
    
    plot.appendChild(plotText);
    farmPlotsContainer.appendChild(plot);
  }
}

// Handle farm plot clicks
function handleFarmPlotClick(plotIndex) {
  const plot = document.querySelector(`.farm-plot[data-plot-index="${plotIndex}"]`);
  
  if (plot.classList.contains('locked')) {
    showMessage('This plot is locked. Capture more pieces to unlock it.', 'info');
    return;
  }
  
  if (plot.classList.contains('ready')) {
    // Harvest
    wheatCount += 10; // Add wheat from harvest
    updateWheatDisplay();
    
    // Reset plot state
    plot.classList.remove('ready');
    const plotText = plot.querySelector('.farm-plot-text');
    plotText.textContent = 'Plant';
    
    showMessage('Harvested 10 wheat!', 'success');
  } else if (plot.classList.contains('growing')) {
    showMessage('This plot is still growing. Wait for it to be ready to harvest.', 'info');
  } else {
    // Plant if we have enough wheat
    if (wheatCount >= 5) {
      wheatCount -= 5; // Cost to plant
      updateWheatDisplay();
      
      plot.classList.add('growing');
      const plotText = plot.querySelector('.farm-plot-text');
      plotText.textContent = 'Growing';
      
      // Simulate growth (would normally happen over turns)
      setTimeout(() => {
        plot.classList.remove('growing');
        plot.classList.add('ready');
        plotText.textContent = 'Harvest';
        showMessage('A plot is ready to harvest!', 'success');
      }, 5000); // Just for demo purposes
      
      showMessage('Planted seeds for 5 wheat.', 'info');
    } else {
      showMessage('Not enough wheat to plant. You need 5 wheat.', 'error');
    }
  }
}

// Toggle between chess and farming phases
function toggleGamePhase() {
  // If currently in farming phase, allow switching to chess
  if (currentPhase === 'farming') {
    currentPhase = 'chess';
    updatePhaseDisplay();
    
    // Ensure the board is visible
    if (board) {
      board.resize(); // Ensure board is sized correctly
    }
    
    showMessage('Switched to chess phase. You must make a chess move before ending your turn.', 'info');
  } else {
    // If in chess phase, inform the player they must make a move
    showMessage('You must make a chess move before returning to farming.', 'warning');
  }
}

// Update the phase display in the UI
function updatePhaseDisplay() {
  const phaseDisplay = document.getElementById('phase-display');
  phaseDisplay.textContent = currentPhase === 'chess' ? 'Chess Phase' : 'Farming Phase';
  
  if (currentPhase === 'farming') {
    phaseDisplay.classList.add('farming');
  } else {
    phaseDisplay.classList.remove('farming');
  }
}

// Update wheat count display
function updateWheatDisplay() {
  document.getElementById('wheat-count').textContent = wheatCount;
} 