/**
 * Chess Manager Module
 * Handles all chess-related functionality for the game
 */
const ChessManager = (function() {
  // Private variables
  let initialized = false;
  let chessEngine = null;
  let chessboard = null;
  
  /**
   * Initialize the Chess Manager
   * @returns {boolean} True if initialization was successful
   */
  function initialize() {
    if (initialized) {
      console.warn('Chess Manager already initialized');
      return true;
    }
    
    try {
      console.log('Initializing Chess Manager');
      
      // Initialize chess engine
      if (typeof Chess === 'undefined') {
        console.error('Chess.js library not loaded');
        return false;
      }
      
      chessEngine = new Chess();
      
      // Set up the board when the UI is ready
      setTimeout(setupBoard, 100);
      
      console.log('Chess Manager initialized');
      initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Chess Manager:', error);
      return false;
    }
  }
  
  /**
   * Set up the chessboard
   */
  function setupBoard() {
    const boardElement = document.getElementById('chess-board');
    if (!boardElement) {
      console.warn('Chessboard element not found');
      return;
    }
    
    if (!chessEngine) {
      console.error('Chess engine not initialized');
      return;
    }
    
    // Clear any existing board
    if (chessboard) {
      chessboard.clear();
    }
    
    // Configure the board
    const config = {
      draggable: true,
      position: chessEngine.fen(),
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
      onDragStart: onDragStart,
      onDrop: onDrop,
      onSnapEnd: onSnapEnd
    };
    
    // Create the chessboard
    chessboard = Chessboard(boardElement.id, config);
    
    // Flip the board if the player is black
    if (GameState.getPlayerColor() === 'black') {
      boardElement.style.transform = 'rotate(180deg)';
      
      // Flip all pieces
      const pieces = boardElement.querySelectorAll('.piece-417db');
      pieces.forEach(piece => {
        piece.style.transform = 'rotate(180deg)';
      });
    }
    
    // Update the move costs display
    showMoveCosts();
    
    console.log('Chessboard set up');
  }
  
  /**
   * Handle the start of a piece drag
   * @param {string} source - The source square
   * @param {string} piece - The piece being dragged
   * @param {Object} position - The current board position
   * @param {string} orientation - The board orientation
   * @returns {boolean} Whether the drag is allowed
   */
  function onDragStart(source, piece, position, orientation) {
    console.log(`Attempting to drag piece from ${source}: ${piece}`);
    
    // Do not allow dragging if the game is over
    if (chessEngine.game_over()) {
      console.log('Game is over, cannot move pieces');
      return false;
    }
    
    // Only allow the current player to move pieces
    if (!GameState.isPlayerTurn()) {
      console.log('Not your turn, cannot move pieces');
      return false;
    }
    
    // Only allow dragging in the chess phase
    if (GameState.getCurrentGamePhase() !== 'chess') {
      console.log('Not in chess phase, cannot move pieces');
      showMessage('You can only move pieces during the chess phase');
      return false;
    }
    
    // Only allow dragging pieces of the player's color
    const playerColor = GameState.getPlayerColor();
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) ||
        (playerColor === 'black' && piece.search(/^w/) !== -1)) {
      console.log(`Cannot move opponent's pieces (${piece})`);
      return false;
    }
    
    console.log(`Drag allowed for ${piece} from ${source}`);
    return true;
  }
  
  /**
   * Handle a piece being dropped on the board
   * @param {string} source - The source square
   * @param {string} target - The target square
   * @returns {string} 'snapback' to cancel the move, or undefined to allow it
   */
  function onDrop(source, target) {
    // Do not allow moves if not in chess phase
    if (GameState.getCurrentGamePhase() !== 'chess') {
      showMessage('You can only move pieces during the chess phase');
      return 'snapback';
    }
    
    // Check if it's a valid move
    const move = chessEngine.move({
      from: source,
      to: target,
      promotion: 'q' // Always promote to queen for simplicity
    });
    
    // Invalid move
    if (move === null) {
      return 'snapback';
    }
    
    // Get the piece type
    const pieceType = move.piece;
    
    // Calculate the move cost
    const moveCost = GameConfig.pieceCosts[pieceType] || 0;
    
    // Check if player has enough wheat
    const playerColor = GameState.getPlayerColor();
    if (!GameState.updateWheat(playerColor, -moveCost)) {
      // Undo the move
      chessEngine.undo();
      showMessage(`Not enough wheat to move this piece (cost: ${moveCost})`);
      return 'snapback';
    }
    
    // Check if a piece was captured
    if (move.captured) {
      console.log(`Captured a ${move.captured} piece!`);
      GameState.recordCapture(playerColor);
      showMessage(`Captured ${getPieceName(move.captured)}!`);
    }
    
    // Update the server
    SocketManager.sendChessMove(move);
    
    // Check for checkmate
    if (chessEngine.in_checkmate()) {
      GameState.declareWinner(playerColor, 'checkmate');
      showMessage('Checkmate!');
    } else if (chessEngine.in_check()) {
      showMessage('Check!');
    }
    
    // Update the move cost display
    showMoveCosts();
    
    return undefined;
  }
  
  /**
   * Handle the end of a piece move
   */
  function onSnapEnd() {
    // Update the board position
    if (chessboard) {
      chessboard.position(chessEngine.fen());
    }
  }
  
  /**
   * Update the chessboard display
   */
  function updateBoard() {
    if (chessboard && chessEngine) {
      chessboard.position(chessEngine.fen());
    }
  }
  
  /**
   * Process a chess move from the server
   * @param {Object} move - The move object
   */
  function processChessMove(move) {
    if (!chessEngine) {
      console.error('Chess engine not initialized');
      return;
    }
    
    // Make the move
    const result = chessEngine.move(move);
    if (result === null) {
      console.error('Invalid move received from server:', move);
      return;
    }
    
    console.log('Processed move from server:', move);
    
    // Update the board
    updateBoard();
    
    // Check for checkmate
    if (chessEngine.in_checkmate()) {
      const winner = chessEngine.turn() === 'w' ? 'black' : 'white';
      GameState.declareWinner(winner, 'checkmate');
      showMessage('Checkmate!');
    } else if (chessEngine.in_check()) {
      showMessage('Check!');
    }
  }
  
  /**
   * Get a human-readable name for a piece
   * @param {string} pieceCode - The piece code (p, n, b, r, q, k)
   * @returns {string} The human-readable piece name
   */
  function getPieceName(pieceCode) {
    const pieceNames = {
      p: 'Pawn',
      n: 'Knight',
      b: 'Bishop',
      r: 'Rook',
      q: 'Queen',
      k: 'King'
    };
    
    return pieceNames[pieceCode.toLowerCase()] || 'Unknown Piece';
  }
  
  /**
   * Display the movement costs for all pieces
   */
  function showMoveCosts() {
    const moveCostsElement = document.getElementById('move-costs-display');
    if (!moveCostsElement) {
      console.warn('Move costs display element not found');
      return;
    }
    
    let html = `
      <div class="move-costs-info">
        <h4>Movement Costs (Wheat)</h4>
        <ul>
    `;
    
    // Add each piece cost
    Object.entries(GameConfig.pieceCosts).forEach(([piece, cost]) => {
      html += `<li>${getPieceName(piece)}: ${cost}</li>`;
    });
    
    html += `
        </ul>
      </div>
    `;
    
    moveCostsElement.innerHTML = html;
  }
  
  // Public API
  return {
    initialize,
    setupBoard,
    updateBoard,
    processChessMove,
    showMoveCosts
  };
})(); 