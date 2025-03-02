// ChessVille - Farm Chess Game
// Main client entry point

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
  console.log('ChessVille initializing...');
  
  // Initialize all modules in the correct order
  GameState.initialize();
  UIManager.initialize();
  ChessManager.initialize();
  FarmManager.initialize();
  SocketManager.initialize();
  
  console.log('ChessVille initialization complete');
  
  // Show a welcome message
  showMessage('Welcome to ChessVille!', 3000);
});

// Global helper function for showing messages to users
function showMessage(message, duration = 3000) {
  const messageElement = document.getElementById('message-box');
  if (!messageElement) {
    console.warn('Message box element not found in DOM');
    console.log(`Message: ${message}`);
    return;
  }
  
  messageElement.textContent = message;
  messageElement.classList.add('visible');
  
  setTimeout(() => {
    messageElement.classList.remove('visible');
  }, duration);
} 
