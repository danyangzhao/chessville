# Chess Farmer - Multiplayer Game

A multiplayer chess game with a farming twist! Move chess pieces, capture opponents, and grow corn to win.

## Features

- Real-time multiplayer gameplay
- Room-based mechanics for private games
- Chess move validation using chess.js
- Resource management using corn
- Farming system with planting and harvesting

## How to Play

### Setup

1. **Prerequisites**:
   - Node.js (v12 or higher)
   - npm (v6 or higher)

2. **Installation**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/chessville.git
   cd chessville

   # Install dependencies
   npm install
   ```

3. **Start the server**:
   ```bash
   node server.js
   ```

4. **Access the game**:
   Open your browser and navigate to `http://localhost:3000`

### Game Rules

1. **Starting a Game**:
   - Create a new room or join an existing one with a room ID
   - Share the room ID with a friend to play together
   - First player is assigned white, second player is assigned black

2. **Gameplay**:
   - Players take turns moving chess pieces and managing their farms
   - Each chess piece costs corn to move:
     - Pawn: 5 corn
     - Knight: 10 corn
     - Bishop: 8 corn
     - Rook: 12 corn
     - Queen: 15 corn
     - King: 7 corn

3. **Farming**:
   - Each player starts with 100 corn and 2 unlocked farm plots
   - Actions:
     - Plant: Costs 3 corn, takes 3 turns to grow
     - Harvest: Yields 10 corn when ready
     - Unlock: Costs 5 corn to unlock additional plots

4. **Winning**:
   - Checkmate your opponent
   - OR collect 200 corn first

## Codebase Structure

The game consists of three main components:

1. **Server (`server.js`)**: Handles game state, player connections, and game logic
2. **Client (`client.js`)**: Manages the user interface and client-side game logic
3. **HTML/CSS (`index.html`)**: Provides the game interface and styling

## Development

The codebase has been refactored for simplicity and maintainability. Key improvements include:

- Streamlined server-side logic for game state management
- Simplified client-side code with improved turn handling
- Clean and responsive user interface
- Improved error handling and logging

## License

MIT

## Acknowledgments

- [chess.js](https://github.com/jhlywa/chess.js) for chess move validation
- [Socket.IO](https://socket.io/) for real-time communication
- [Express](https://expressjs.com/) for the web server 