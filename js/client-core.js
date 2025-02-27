// Entry point for Chess Farmer client-side code

// Wait for the DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Chessville initializing...');
  
  try {
    // Check if critical modules are loaded
    if (typeof GameConfig === 'undefined') {
      console.error('GameConfig module is not loaded. Check script loading order.');
      return;
    }
    
    if (typeof GameState === 'undefined') {
      console.error('GameState module is not loaded. Check script loading order.');
      return;
    }
    
    // Initialize the UI Manager
    if (!UIManager.initialize()) {
      console.error('Failed to initialize UI Manager');
      return;
    }
    
    // Initialize the Game State
    if (!GameState.initialize()) {
      console.error('Failed to initialize Game State');
      return;
    }
    
    // Initialize the Farm Manager
    if (!FarmManager.initialize()) {
      console.error('Failed to initialize Farm Manager');
      return;
    }
    
    // Initialize the Chess Manager
    if (!ChessManager.initialize()) {
      console.error('Failed to initialize Chess Manager');
      return;
    }
    
    // Initialize the Socket Manager
    if (!SocketManager.initialize()) {
      console.error('Failed to initialize Socket Manager');
      return;
    }
    
    // Set up debug panel functionality
    setupDebugPanel();
    
    console.log('Chessville initialization complete');
    
    // Show the login screen
    UIManager.showScreen('login-screen');
    
    // Display the chess piece movement costs in the UI
    ChessManager.showMoveCosts();
    
  } catch (error) {
    console.error('Critical initialization error:', error);
  }
});

// Set up debug panel functionality
function setupDebugPanel() {
  // Debug panel elements
  const debugPanel = document.getElementById('debug-panel');
  const debugInfo = document.getElementById('debug-info');
  const closeDebugBtn = document.getElementById('debug-close-btn');
  
  if (!debugPanel || !debugInfo || !closeDebugBtn) {
    console.warn('Debug panel elements not found');
    return;
  }
  
  // Update debug info function
  window.updateDebugInfo = function() {
    if (debugPanel.classList.contains('hidden')) return;
    
    // Get current game state
    const state = {
      playerColor: GameState.getPlayerColor(),
      currentTurn: GameState.getCurrentTurn(),
      currentPhase: GameState.getCurrentGamePhase(),
      isPlayerTurn: GameState.isPlayerTurn(),
      roomId: GameState.getRoomId(),
      wheat: {
        white: GameState.getWheat('white'),
        black: GameState.getWheat('black')
      }
    };
    
    // Format and display debug info
    debugInfo.innerHTML = `
      <div><b>Player Color:</b> ${state.playerColor || 'Not assigned'}</div>
      <div><b>Room ID:</b> ${state.roomId || 'Not in a room'}</div>
      <div><b>Current Turn:</b> ${state.currentTurn}</div>
      <div><b>Is Player's Turn:</b> ${state.isPlayerTurn}</div>
      <div><b>Current Phase:</b> ${state.currentPhase}</div>
      <div><b>White Wheat:</b> ${state.wheat.white}</div>
      <div><b>Black Wheat:</b> ${state.wheat.black}</div>
    `;
  };
  
  // Toggle debug panel with Alt+D
  document.addEventListener('keydown', function(event) {
    if (event.altKey && event.key === 'd') {
      debugPanel.classList.toggle('hidden');
      if (!debugPanel.classList.contains('hidden')) {
        updateDebugInfo();
        // Start updating debug info every second
        window.debugInterval = setInterval(updateDebugInfo, 1000);
      } else {
        // Stop updating when panel is hidden
        clearInterval(window.debugInterval);
      }
    }
  });
  
  // Close button
  closeDebugBtn.addEventListener('click', function() {
    debugPanel.classList.add('hidden');
    clearInterval(window.debugInterval);
  });
}

// Global utility function for showing messages
function showMessage(message, duration = 3000) {
  const messageElement = document.getElementById('message');
  if (!messageElement) {
    console.warn('Message element not found');
    return;
  }
  
  messageElement.textContent = message;
  messageElement.classList.add('visible');
  
  setTimeout(() => {
    messageElement.classList.remove('visible');
  }, duration);
}

// Chessboard.js configuration
var config = {
  pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
}; 