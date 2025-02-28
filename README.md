# Chess Farm Game

A multiplayer chess game that will eventually include farming mechanics. This project is built with Node.js, Express, Socket.io, and Chess.js.

## Features

- **Multiplayer Chess**: Play chess with another player in real-time
- **Room-based Gameplay**: Create or join game rooms with unique room codes
- **Turn-based System**: Proper turn management and validation
- **Responsive UI**: Works on both desktop and mobile devices
- **Game Status Updates**: Real-time updates about game state, checkmate, draws, etc.

## Future Features

- Farming mechanics integration
- Player profiles and statistics
- Chat functionality
- Game replay and analysis

## Project Structure

```
chess-farm-game/
├── server.js           # Main server file with Socket.io logic
├── package.json        # Project dependencies and scripts
├── public/             # Client-side files
│   ├── index.html      # Main HTML file
│   ├── css/
│   │   └── styles.css  # CSS styles
│   ├── js/
│   │   └── app.js      # Client-side JavaScript
│   └── images/         # Game images and assets
```

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`

## How to Play

1. Enter your name and optionally a room code to join a specific game.
2. If you don't enter a room code, a new game room will be created.
3. Share the displayed room code with your opponent.
4. Once your opponent joins, the game will start automatically.
5. White goes first. Make moves by dragging and dropping pieces.
6. The game ends when there's a checkmate or a draw.

## Technologies Used

- **Node.js**: Server-side JavaScript runtime
- **Express**: Web framework for Node.js
- **Socket.io**: Real-time bidirectional event-based communication
- **Chess.js**: Chess move validation and game state
- **Chessboard.js**: Chess board UI and interaction

## Development

To run the game in development mode with auto-restart:
```
npm run dev
```

## License

MIT 