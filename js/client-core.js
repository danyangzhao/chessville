// Entry point for Chess Farmer client-side code

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, starting game initialization...');
  
  try {
    // Initialize all modules in the proper order
    console.log('Initializing UI Manager...');
    UIManager.initialize();
    
    console.log('Initializing Game State...');
    GameState.initialize();
    
    console.log('Initializing Chess Manager...');
    ChessManager.initialize();
    
    console.log('Initializing Farm Manager...');
    FarmManager.initialize();
    
    console.log('Initializing Socket Manager...');
    SocketManager.initialize();
    
    console.log('Game initialization complete');
    
    // Show a welcome message
    showMessage('Welcome to ChessVille!', 3000);
  } catch (error) {
    console.error('Error during initialization:', error);
    showMessage('Error initializing game. Check console for details.', 5000);
  }
});

// Global utility function to show messages to user
function showMessage(message, duration = 3000) {
  const messageEl = document.getElementById('message');
  if (!messageEl) {
    console.warn('Message element not found');
    return;
  }
  
  messageEl.textContent = message;
  messageEl.classList.add('visible');
  
  setTimeout(() => {
    messageEl.classList.remove('visible');
  }, duration);
} 

// Chessboard.js configuration
var config = {
  pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
}; 