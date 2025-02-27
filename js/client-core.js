// Entry point for Chess Farmer client-side code

// Wait for the DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Chessville initializing...');
  
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
  
  // Initialize the Chess Manager
  if (!ChessManager.initialize()) {
    console.error('Failed to initialize Chess Manager');
    return;
  }
  
  // Initialize the Farm Manager
  if (!FarmManager.initialize()) {
    console.error('Failed to initialize Farm Manager');
    return;
  }
  
  // Initialize the Socket Manager
  if (!SocketManager.initialize()) {
    console.error('Failed to initialize Socket Manager');
    return;
  }
  
  console.log('Chessville initialization complete');
  
  // Show the login screen
  UIManager.showScreen('login-screen');
  
  // Display the chess piece movement costs in the UI
  ChessManager.showMoveCosts();
});

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