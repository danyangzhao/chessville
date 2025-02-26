// Farm management module

const FarmManager = (() => {
  // Private variables
  
  // Helper function to get player's farm element
  function getPlayerFarmElement(playerKey) {
    if (playerKey === 'player1') {
      return document.getElementById('player1-farm');
    } else if (playerKey === 'player2') {
      return document.getElementById('player2-farm');
    }
    return null;
  }
  
  // Public methods
  return {
    initialize() {
      console.log('Initializing farm manager');
      
      // Initialize default farm state
      const gameState = GameState.getGameState();
      if (!gameState.farms) {
        gameState.farms = {
          player1: {
            corn: 100,
            unlocked: 2,
            unlockable: 3,
            captureRequired: [],
            totalCaptures: 0,
            plots: []
          },
          player2: {
            corn: 100,
            unlocked: 2,
            unlockable: 3,
            captureRequired: [],
            totalCaptures: 0,
            plots: []
          }
        };
      }
    },
    
    initializeFarms() {
      const gameState = GameState.getGameState();
      
      // Make sure farms object exists
      if (!gameState.farms) {
        console.error('Farms not initialized in game state');
        this.initialize();
      }
      
      // Initialize both farms
      this.initializePlayerFarm('player1');
      this.initializePlayerFarm('player2');
      
      console.log('Farms initialized for both players');
    },
    
    initializePlayerFarm(playerKey) {
      const gameState = GameState.getGameState();
      
      if (!gameState.farms || !gameState.farms[playerKey]) {
        console.error(`Farm not found for ${playerKey}`);
        return;
      }
      
      const farmElement = getPlayerFarmElement(playerKey);
      if (!farmElement) {
        console.error(`Farm element not found for ${playerKey}`);
        return;
      }
      
      // Clear existing farm
      farmElement.innerHTML = '';
      
      // Create plot containers based on the farm data
      const farm = gameState.farms[playerKey];
      const maxPlots = 12; // Maximum number of plots to display
      
      for (let i = 0; i < maxPlots; i++) {
        const plotDiv = document.createElement('div');
        plotDiv.className = 'farm-plot';
        plotDiv.setAttribute('data-plot-index', i);
        
        // Check if plot exists in data
        const plotData = farm.plots && farm.plots[i];
        
        if (plotData) {
          // Plot is already initialized
          plotDiv.className = `farm-plot ${plotData.state || 'locked'}`;
          
          if (plotData.state === 'planted') {
            // Add plant visualization
            const plantDiv = document.createElement('div');
            plantDiv.className = `plant ${plotData.plantType} ${plotData.growthStage || 'seedling'}`;
            plotDiv.appendChild(plantDiv);
            
            // Add harvest button for mature plants
            if (plotData.growthStage === 'mature') {
              const harvestBtn = document.createElement('button');
              harvestBtn.className = 'harvest-button';
              harvestBtn.textContent = 'Harvest';
              harvestBtn.setAttribute('data-plot-index', i);
              harvestBtn.addEventListener('click', () => this.harvestPlot(playerKey, i));
              plotDiv.appendChild(harvestBtn);
            }
          } else if (plotData.state === 'unlocked') {
            // Add plant button for unlocked plots
            const plantBtn = document.createElement('button');
            plantBtn.className = 'plant-button';
            plantBtn.textContent = 'Plant';
            plantBtn.setAttribute('data-plot-index', i);
            plantBtn.addEventListener('click', () => this.showPlantSelector(playerKey, i));
            plotDiv.appendChild(plantBtn);
          } else if (plotData.state === 'locked') {
            // Add unlock button (only for the player's own farm)
            if (playerKey === GameState.getPlayerFarmKey()) {
              const unlockBtn = document.createElement('button');
              unlockBtn.className = 'unlock-plot-button';
              unlockBtn.textContent = 'Unlock';
              unlockBtn.setAttribute('data-plot-index', i);
              plotDiv.appendChild(unlockBtn);
            }
          }
        } else {
          // Determine if the plot should be unlockable or locked
          const isUnlocked = i < (farm.unlocked || 2);
          const isUnlockable = i < (farm.unlocked || 2) + (farm.unlockable || 3);
          
          if (isUnlocked) {
            plotDiv.className = 'farm-plot unlocked';
            
            // Add plant button
            const plantBtn = document.createElement('button');
            plantBtn.className = 'plant-button';
            plantBtn.textContent = 'Plant';
            plantBtn.setAttribute('data-plot-index', i);
            plantBtn.addEventListener('click', () => this.showPlantSelector(playerKey, i));
            plotDiv.appendChild(plantBtn);
            
            // Initialize in game state
            if (!farm.plots) farm.plots = [];
            farm.plots[i] = { state: 'unlocked' };
          } else if (isUnlockable && playerKey === GameState.getPlayerFarmKey()) {
            plotDiv.className = 'farm-plot locked unlockable';
            
            // Add unlock button
            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'unlock-plot-button';
            unlockBtn.textContent = 'Unlock';
            unlockBtn.setAttribute('data-plot-index', i);
            plotDiv.appendChild(unlockBtn);
            
            // Initialize in game state
            if (!farm.plots) farm.plots = [];
            farm.plots[i] = { state: 'locked' };
          } else {
            plotDiv.className = 'farm-plot locked';
            
            // Initialize in game state
            if (!farm.plots) farm.plots = [];
            farm.plots[i] = { state: 'locked' };
          }
        }
        
        farmElement.appendChild(plotDiv);
      }
      
      console.log(`Farm initialized for ${playerKey}`);
    },
    
    updateCornCounts() {
      const gameState = GameState.getGameState();
      
      // Make sure we have the game state and farms
      if (!gameState || !gameState.farms) {
        console.warn('Cannot update corn counts: Game state or farms not initialized');
        return;
      }
      
      // Update corn counts for both players
      const player1CornElement = document.getElementById('player1-corn');
      const player2CornElement = document.getElementById('player2-corn');
      
      if (player1CornElement && gameState.farms.player1) {
        player1CornElement.textContent = gameState.farms.player1.corn || 0;
        console.log(`Updated player1 corn count: ${gameState.farms.player1.corn}`);
      }
      
      if (player2CornElement && gameState.farms.player2) {
        player2CornElement.textContent = gameState.farms.player2.corn || 0;
        console.log(`Updated player2 corn count: ${gameState.farms.player2.corn}`);
      }
    },
    
    unlockPlot(plotIndex) {
      const playerKey = GameState.getPlayerFarmKey();
      const gameState = GameState.getGameState();
      
      if (!gameState.farms || !gameState.farms[playerKey]) {
        console.error(`Farm not found for ${playerKey}`);
        return;
      }
      
      const farm = gameState.farms[playerKey];
      
      // Check if the plot is already unlocked
      if (farm.plots[plotIndex] && farm.plots[plotIndex].state !== 'locked') {
        console.log(`Plot ${plotIndex} is already unlocked`);
        showMessage('This plot is already unlocked');
        return;
      }
      
      // Calculate unlock cost (could be more complex in the future)
      const unlockCost = 30;
      
      // Check if player has enough corn
      if (farm.corn >= unlockCost) {
        // Unlock the plot
        farm.corn -= unlockCost;
        
        // Make sure plots array exists
        if (!farm.plots) farm.plots = [];
        
        // Update plot state
        farm.plots[plotIndex] = { state: 'unlocked' };
        
        // Increment unlocked count, decrement unlockable count
        farm.unlocked = (farm.unlocked || 0) + 1;
        farm.unlockable = Math.max(0, (farm.unlockable || 0) - 1);
        
        // Update UI
        this.initializePlayerFarm(playerKey);
        this.updateCornCounts();
        
        console.log(`Unlocked plot ${plotIndex}. New corn: ${farm.corn}`);
        showMessage(`Unlocked plot for ${unlockCost} corn!`);
        
        // Send update to server
        SocketManager.sendGameStateUpdate();
      } else {
        console.log(`Not enough corn to unlock plot. Have: ${farm.corn}, Need: ${unlockCost}`);
        showMessage(`Not enough corn! You need ${unlockCost} corn to unlock this plot.`);
      }
    },
    
    showPlantSelector(playerKey, plotIndex) {
      // Only allow planting on your own farm
      if (playerKey !== GameState.getPlayerFarmKey()) {
        console.log(`Cannot plant on opponent's farm`);
        showMessage('You can only plant on your own farm!');
        return;
      }
      
      const modal = document.getElementById('plant-selector-modal');
      if (!modal) {
        console.error('Plant selector modal not found');
        return;
      }
      
      // Store the target plot info
      GameState.getPlayerState().selectedPlot = {
        playerKey: playerKey,
        plotIndex: plotIndex
      };
      
      // Display the modal
      modal.style.display = 'block';
      
      // Set up plant buttons
      document.querySelectorAll('.plant-choice').forEach(btn => {
        btn.onclick = () => {
          const plantType = btn.getAttribute('data-plant-type');
          this.plantCrop(playerKey, plotIndex, plantType);
          modal.style.display = 'none';
        };
      });
      
      // Set up cancel button
      const cancelBtn = document.getElementById('cancel-plant');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          modal.style.display = 'none';
        };
      }
    },
    
    plantCrop(playerKey, plotIndex, plantType) {
      const gameState = GameState.getGameState();
      const cropData = GameState.getCropData();
      
      if (!gameState.farms || !gameState.farms[playerKey]) {
        console.error(`Farm not found for ${playerKey}`);
        return;
      }
      
      const farm = gameState.farms[playerKey];
      
      // Check if the plot is unlocked
      if (!farm.plots[plotIndex] || farm.plots[plotIndex].state !== 'unlocked') {
        console.log(`Plot ${plotIndex} is not available for planting`);
        showMessage('This plot is not available for planting');
        return;
      }
      
      // Get cost of the plant
      const cost = cropData[plantType] ? cropData[plantType].cost : 10;
      
      // Check if player has enough corn
      if (farm.corn >= cost) {
        // Deduct cost
        farm.corn -= cost;
        
        // Update plot with the plant
        farm.plots[plotIndex] = {
          state: 'planted',
          plantType: plantType,
          growthStage: 'seedling',
          turnsPlanted: 0,
          turnsToGrow: cropData[plantType] ? cropData[plantType].growthTime : 3
        };
        
        // Update UI
        this.initializePlayerFarm(playerKey);
        this.updateCornCounts();
        
        console.log(`Planted ${plantType} in plot ${plotIndex}. New corn: ${farm.corn}`);
        showMessage(`Planted ${plantType} for ${cost} corn!`);
        
        // Send update to server
        SocketManager.sendGameStateUpdate();
      } else {
        console.log(`Not enough corn to plant ${plantType}. Have: ${farm.corn}, Need: ${cost}`);
        showMessage(`Not enough corn! You need ${cost} corn to plant ${plantType}.`);
      }
    },
    
    harvestPlot(playerKey, plotIndex) {
      const gameState = GameState.getGameState();
      const cropData = GameState.getCropData();
      
      if (!gameState.farms || !gameState.farms[playerKey]) {
        console.error(`Farm not found for ${playerKey}`);
        return;
      }
      
      const farm = gameState.farms[playerKey];
      
      // Check if the plot has a mature plant
      const plot = farm.plots[plotIndex];
      if (!plot || plot.state !== 'planted' || plot.growthStage !== 'mature') {
        console.log('This plot cannot be harvested yet');
        showMessage('This plant is not ready for harvest yet');
        return;
      }
      
      // Get the yield from the crop
      const yieldAmount = cropData[plot.plantType] ? cropData[plot.plantType].yield : 3;
      
      // Add yield to corn count
      farm.corn += yieldAmount;
      
      // Reset plot to unlocked state
      farm.plots[plotIndex] = { state: 'unlocked' };
      
      // Update UI
      this.initializePlayerFarm(playerKey);
      this.updateCornCounts();
      
      console.log(`Harvested ${plot.plantType} from plot ${plotIndex}. Yield: ${yieldAmount}, New corn: ${farm.corn}`);
      showMessage(`Harvested ${yieldAmount} corn!`);
      
      // Check for victory condition
      if (farm.corn >= 200) {
        console.log(`Player ${playerKey} has reached 200 corn!`);
        SocketManager.sendGameOver('corn');
      }
      
      // Send update to server
      SocketManager.sendGameStateUpdate();
    },
    
    growPlants() {
      const gameState = GameState.getGameState();
      
      if (!gameState.farms) {
        console.error('Farms not initialized');
        return;
      }
      
      let plantsGrown = false;
      
      // Update both farms
      ['player1', 'player2'].forEach(playerKey => {
        const farm = gameState.farms[playerKey];
        
        if (!farm || !farm.plots) return;
        
        farm.plots.forEach((plot, index) => {
          if (plot && plot.state === 'planted' && plot.growthStage !== 'mature') {
            // Increment turns planted
            plot.turnsPlanted = (plot.turnsPlanted || 0) + 1;
            
            // Check if plant has grown
            if (plot.turnsPlanted >= plot.turnsToGrow) {
              // Plant is mature now
              plot.growthStage = 'mature';
              plantsGrown = true;
              console.log(`Plant in ${playerKey} plot ${index} is now mature`);
            } else if (plot.turnsPlanted >= Math.floor(plot.turnsToGrow / 2)) {
              // Plant is in growing stage
              plot.growthStage = 'growing';
              plantsGrown = true;
              console.log(`Plant in ${playerKey} plot ${index} is now growing`);
            }
          }
        });
      });
      
      // Update UI if any plants grew
      if (plantsGrown) {
        this.initializeFarms();
        showMessage('Your crops have grown!');
      }
      
      return plantsGrown;
    },
    
    refreshFarms() {
      this.initializeFarms();
      this.updateCornCounts();
    }
  };
})(); 