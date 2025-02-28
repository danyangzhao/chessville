# Heroku Deployment Instructions
Follow these steps to deploy your Chess Farm Game to Heroku:

1. Install the Heroku CLI if you haven't already:
   npm install -g heroku

2. Login to your Heroku account:
   heroku login

3. Create a new Heroku app:
   heroku create your-chess-farm-game

4. Push your code to Heroku:
   git push heroku main

5. Open your deployed app:
   heroku open

Note: The app is already configured to use the PORT environment variable provided by Heroku.
