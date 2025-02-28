# Heroku Deployment Fixes

## Issues Encountered and Solutions

### 1. Chess.js Module Not Found Error

**Issue:**
```
Error: Cannot find module '/app/node_modules/chess.js/dist/cjs/chess.js'. Please verify that the package.json has a valid "main" entry
```

**Solution:**
Changed the chess.js dependency version in package.json:
```json
// From
"chess.js": "^1.0.0-beta.6"
// To
"chess.js": "^0.12.0"
```

The beta version has a different file structure that caused import issues on Heroku. Using the stable version resolved this problem.

### 2. Chess Piece Images 404 Errors

**Issue:**
```
heroku[router]: at=info method=GET path="/img/chesspieces/wikipedia/wP.png" host=chessville-edb8e53bb6f5.herokuapp.com request_id=d07ff092-9798-4bb7-bd94-58951786bc25 fwd="68.123.11.228" dyno=web.1 connect=0ms service=1ms status=404 bytes=415 protocol=https
```

Chess piece images were not being found on the server, resulting in 404 errors.

**Solution:**
Updated the pieceTheme URL in all relevant JavaScript files to use the unpkg CDN:

```javascript
// Changed from
pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
// To
pieceTheme: 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/img/chesspieces/wikipedia/{piece}.png'
```

Files updated:
- js/client-core.js
- js/modules/chess-manager.js
- public/js/app.js

Using a reliable CDN ensures that the chess piece images are available without needing to host them on our server.

## Deployment Instructions After Fixes

1. Commit the changes to your repository:
   ```
   git add .
   git commit -m "Fix chess.js dependency and update chess piece image URLs for Heroku deployment"
   ```

2. Push to Heroku:
   ```
   git push heroku main
   ```

3. Verify the deployment:
   ```
   heroku open
   ```

## Additional Fix: Local Hosting of Chess Piece Images

**Issue:**
Despite using a CDN for chess piece images, there were still occasional issues with images not loading properly due to potential CORS restrictions or CDN reliability.

**Solution:**
1. Downloaded all chess piece images from the chessboardjs GitHub repository
2. Created a local directory structure: `/public/img/chesspieces/wikipedia/`
3. Extracted the images to this directory
4. Updated all pieceTheme references to use the local path:

```javascript
pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
```

Files updated:
- js/client-core.js
- js/modules/chess-manager.js
- public/js/app.js

This approach eliminates external dependencies for chess piece images, ensuring they are always available regardless of external service status.

## Verifying the Fixes

After deploying, check the Heroku logs to ensure no more errors are occurring:
```
heroku logs --tail
```

The application should now start successfully without module errors, and the chess pieces should be visible on the board. 

## Additional Static File Serving Fix

**Issue:**
Even after implementing local hosting for chess piece images, 404 errors persisted on Heroku:
```
GET https://chessville-edb8e53bb6f5.herokuapp.com/img/chesspieces/wikipedia/wQ.png 404 (Not Found)
GET https://chessville-edb8e53bb6f5.herokuapp.com/img/chesspieces/wikipedia/bP.png 404 (Not Found)
```

**Diagnosis:**
The Express static file middleware was only configured to serve files from the root directory, but the chess piece images were located in the `public` directory.

**Solution:**
Added an additional static file middleware to serve files from the `public` directory:

```javascript
// Original configuration
app.use(express.static(__dirname));

// Added this additional middleware to serve files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
```

This ensures that Express will look in both the root directory and the `public` directory when serving static files, allowing the chess piece images to be properly accessed at the path `/img/chesspieces/wikipedia/{piece}.png`.

**Summary of Fixed Issues:**
1. Chess.js module import error - Fixed by using a stable version
2. Chess piece image 404 errors - Fixed by:
   - First, downloading and hosting the images locally
   - Then, properly configuring Express to serve static files from the public directory 