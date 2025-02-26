// Chess board management module

const ChessManager = (() => {
  // Private variables
  let board = null;
  
  // Drag and drop handlers
  function onDragStart(source, piece, position, orientation) {
    const playerState = GameState.getPlayerState();
    const gameState = GameState.getGameState();
    const chess = GameState.getChess();
    
    // Only allow the current player to move their pieces
    if (!GameState.isPlayerTurn()) {
      console.log('Not your turn');
      return false;
    }
    
    // Check if the piece belongs to the current player
    const pieceColor = piece.charAt(0) === 'w' ? 'white' : 'black';
    if (pieceColor !== playerState.playerColor) {
      console.log('Not your piece');
      return false;
    }
    
    // Make sure chess is initialized
    if (!chess) {
      console.error('Chess engine not initialized');
      return false;
    }
    
    // Check if the piece can move
    const moves = chess.moves({ square: source, verbose: true });
    if (moves.length === 0) {
      console.log('No legal moves for this piece');
      return false;
    }
    
    // Store selected piece
    playerState.selectedPiece = source;
    return true;
  }
  
  function onDrop(source, target) {
    const chess = GameState.getChess();
    
    // Don't allow drops on invalid squares
    if (!chess) {
      console.error('Chess engine not initialized');
      return 'snapback';
    }
    
    // See if the move is legal
    try {
      const move = chess.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
      });
      
      // If the move is illegal, return 'snapback'
      if (move === null) {
        return 'snapback';
      }
      
      // Valid move
      console.log(`Move made: ${source} to ${target}`);
      
      // Update game state
      GameState.getGameState().chessEngineState = chess.fen();
      
      // Send move to server
      SocketManager.sendMove(source, target);
      
      // Check for checkmate
      if (chess.in_checkmate()) {
        console.log('Checkmate!');
        showMessage('Checkmate!', 5000);
      }
    } catch (error) {
      console.error('Error making move:', error);
      return 'snapback';
    }
  }
  
  function onSnapEnd() {
    // Update the board to the current position
    if (board) {
      const chess = GameState.getChess();
      if (chess) {
        board.position(chess.fen());
      }
    }
  }
  
  // Public methods
  return {
    initialize() {
      console.log('Initializing chess manager');
      
      // Make sure chessboard.js is loaded
      if (typeof Chessboard === 'undefined') {
        console.error('Chessboard.js not loaded');
        return false;
      }
      
      return true;
    },
    
    setupBoard() {
      console.log('Setting up chess board');
      
      try {
        // First check if chessboard element exists
        const boardElement = document.getElementById('chess-board');
        if (!boardElement) {
          console.error('Chess board element not found');
          return false;
        }
        
        // Check if chess engine is available
        const chess = GameState.getChess();
        if (!chess) {
          console.error('Chess engine not initialized');
          return false;
        }
        
        // Clear any existing board configuration
        if (board) {
          console.log('Clearing existing board');
          board.clear();
        }
        
        // Create chess board
        const config = {
          draggable: true,
          position: chess.fen(),
          onDragStart: onDragStart,
          onDrop: onDrop,
          onSnapEnd: onSnapEnd,
          pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        };
        
        console.log('Creating board with config:', config);
        board = Chessboard('chess-board', config);
        
        // Update the turn indicator
        UIManager.updateTurnIndicator();
        
        console.log('Chess board setup complete');
        
        // Make sure the board is visible
        boardElement.style.display = 'block';
        
        return true;
      } catch (error) {
        console.error('Error in setupBoard:', error);
        showMessage('Error setting up board: ' + error.message, 3000);
        return false;
      }
    },
    
    refreshBoard() {
      const chess = GameState.getChess();
      
      if (chess && board) {
        board.position(chess.fen());
        console.log('Chess board refreshed with position:', chess.fen());
        return true;
      } else if (!board) {
        return this.setupBoard();
      }
      
      return false;
    },
    
    getBoard() {
      return board;
    }
  };
})(); 