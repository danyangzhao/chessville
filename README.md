# Chess Farm Game

A multiplayer chess game that will eventually include farming mechanics. This project is built with Node.js, Express, Socket.io, and Chess.js.

## Features

- **Multiplayer Chess**: Play chess with another player in real-time
- **Room-based Gameplay**: Create or join game rooms with unique room codes
- **Turn-based System**: Proper turn management and validation
- **Responsive UI**: Works on both desktop and mobile devices
- **Game Status Updates**: Real-time updates about game state, checkmate, draws, etc.
- **Resource Management**: Chess moves cost wheat, which can be earned through farming and capturing pieces
- **Farming Phase**: Plant and harvest wheat in your farm plots
- **Strategic Gameplay**: Balance chess moves with resource management

## Future Features

- Enhanced farming mechanics
- Player profiles and statistics
- Chat functionality
- Game replay and analysis

## Project Structure

```
chessville/
├── server.js           # Main server file with Socket.io logic
├── package.json        # Project dependencies and scripts
├── Procfile            # Heroku deployment configuration
├── public/             # Client-side files
│   ├── index.html      # Main HTML file
│   ├── css/
│   │   └── styles.css  # CSS styles
│   ├── js/
│   │   └── app.js      # Client-side JavaScript
│   └── images/         # Game images and assets
├── js/                 # Server-side modules
│   └── modules/        # Game logic modules
│       ├── chess-manager.js    # Chess game management
│       ├── game-state.js       # Game state handling
│       └── ...
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
4. Open your browser and navigate to `http://localhost:3002`

## How to Play

1. Enter your name and optionally a room code to join a specific game.
2. If you don't enter a room code, a new game room will be created.
3. Share the displayed room code with your opponent.
4. Once your opponent joins, the game will start automatically.
5. White goes first. Make moves by dragging and dropping pieces.
6. Each chess piece costs wheat to move (Pawns cost 1, Knights cost 3, etc.)
7. You can earn wheat by farming during the farming phase or by capturing opponent pieces.
8. You must make a chess move each turn before ending your turn.
9. If you cannot afford any legal moves, you will lose the game.

## Heroku Deployment

This game is configured for easy deployment to Heroku. Follow these steps to deploy:

1. Create a Heroku account if you don't have one
2. Install the Heroku CLI: `npm install -g heroku`
3. Login to Heroku: `heroku login`
4. Create a new Heroku app: `heroku create your-app-name`
5. Push your code to Heroku: `git push heroku main`
6. Open your deployed app: `heroku open`

### Deployment Notes

If you encounter deployment issues, check the following:

1. Chess.js version: Ensure you're using version 0.12.0 in package.json, not the beta version
2. Chess piece images: The app uses the unpkg CDN to load chess piece images
3. Check Heroku logs for troubleshooting: `heroku logs --tail`

For more detailed troubleshooting steps, refer to the `HEROKU_FIXES.md` file.

### Environment Variables

No special environment variables are required, as the app uses `process.env.PORT` which Heroku sets automatically.

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