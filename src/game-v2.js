import { Composer, InputFile } from "grammy";
export const apuesta2 = new Composer();
import * as path from "path";
import * as fs from "fs";
import { createCanvas, loadImage, Image } from 'canvas';
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { Profiler } from './utils/profiler.js';

// Global game variables
const TEAM_TYPES = {
  ROCK: "rock",
  PAPER: "paper",
  SCISSORS: "scissors",
};

const TEAM_COLORS = {
  [TEAM_TYPES.ROCK]: {
    fill: "#f8d87e",
    stroke: "#c19922",
  },
  [TEAM_TYPES.PAPER]: {
    fill: "#e0e0ff",
    stroke: "#9090ff",
  },
  [TEAM_TYPES.SCISSORS]: {
    fill: "#ff9e9e",
    stroke: "#e05555",
  },
};

// Cache for loaded images
const imageCache = {};
// Cache for pre-rendered entity sprites
const spriteCache = {};


// Create a global profiler instance
const profiler = new Profiler();

// Load images before using them
async function loadGameImages() {
  try {
    // Define the resource paths
    const resourcesPath = path.join(process.cwd(), 'resources/ppt-game');
    const imagePaths = {
      [TEAM_TYPES.ROCK]: path.join(resourcesPath, 'rock.png'),
      [TEAM_TYPES.PAPER]: path.join(resourcesPath, 'paper.png'),
      [TEAM_TYPES.SCISSORS]: path.join(resourcesPath, 'scissors.png'),
      'countdown_3': path.join(resourcesPath, 'countdown_3.png'),
      'countdown_2': path.join(resourcesPath, 'countdown_2.png'),
      'countdown_1': path.join(resourcesPath, 'countdown_1.png'),
      'countdown_go': path.join(resourcesPath, 'countdown_go.png'),
    };

    // Create the resources directory if it doesn't exist
    if (!fs.existsSync(resourcesPath)) {
      fs.mkdirSync(resourcesPath, { recursive: true });
    }

    // Load all images
    for (const [type, imagePath] of Object.entries(imagePaths)) {
      imageCache[type] = await loadImage(imagePath);
    }
    
    // Pre-render entity sprites at various sizes for common radius values
    await preRenderEntitySprites();

    return true;
  } catch (error) {
    console.error("Error loading game images:", error);
    return false;
  }
}

// Add a new function to pre-render entity sprites
async function preRenderEntitySprites() {
  profiler.start("util:preRenderEntitySprites");
  console.log("Pre-rendering entity sprites...");
  
  // Define a set of common entity sizes that will be used
  // The keys will be used as identifiers like "rock_21.6" for a rock with radius 21.6
  const radiusSizes = [10, 15, 20, 21.6, 25, 30]; // 21.6 is the typical size (0.03 * 720)
  
  // Pre-render sprites for each entity type and size
  for (const type of [TEAM_TYPES.ROCK, TEAM_TYPES.PAPER, TEAM_TYPES.SCISSORS]) {
    const colors = TEAM_COLORS[type];
    const img = imageCache[type];
    
    if (!img) continue; // Skip if image not loaded
    
    for (const radius of radiusSizes) {
      // Create an identifier for this sprite
      const spriteKey = `${type}_${radius}`;
      
      // Create a small canvas just for this sprite
      const spriteCanvas = createCanvas(radius * 4, radius * 4); // Make canvas big enough
      const spriteCtx = spriteCanvas.getContext('2d');
      
      // Clear the canvas
      spriteCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
      
      // Draw the circle background
      const centerX = spriteCanvas.width / 2;
      const centerY = spriteCanvas.height / 2;
      
      spriteCtx.beginPath();
      spriteCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      spriteCtx.fillStyle = colors.fill;
      spriteCtx.fill();
      spriteCtx.lineWidth = 2;
      spriteCtx.strokeStyle = colors.stroke;
      spriteCtx.stroke();
      
      // Draw the image on top
      const imgSize = radius * 1.8; // Same sizing as in drawEntity
      spriteCtx.drawImage(img, centerX - imgSize/2, centerY - imgSize/2, imgSize, imgSize);
      
      // Store the pre-rendered sprite
      spriteCache[spriteKey] = spriteCanvas;
    }
  }
  
  // Also pre-render capture effect sprites
  for (const radius of radiusSizes) {
    for (let effectStrength = 0.2; effectStrength <= 1.0; effectStrength += 0.2) {
      const effectKey = `capture_${radius}_${effectStrength.toFixed(1)}`;
      
      const effectCanvas = createCanvas(radius * 6, radius * 6);
      const effectCtx = effectCanvas.getContext('2d');
      
      const centerX = effectCanvas.width / 2;
      const centerY = effectCanvas.height / 2;
      
      effectCtx.beginPath();
      effectCtx.arc(centerX, centerY, radius * (1 + effectStrength * 0.5), 0, Math.PI * 2);
      effectCtx.strokeStyle = `rgba(255, 255, 255, ${effectStrength})`;
      effectCtx.lineWidth = 3;
      effectCtx.stroke();
      
      spriteCache[effectKey] = effectCanvas;
    }
  }
  
  console.log(`Pre-rendered ${Object.keys(spriteCache).length} sprites`);
  profiler.end("util:preRenderEntitySprites");
}

/**
 * This new version of the command separates the simulation from rendering
 * by first running and storing all simulation states, then rendering them
 * to improve performance.
 */
apuesta2.command("apuesta2", async (ctx) => {
  console.log("Ejecutando apuesta2 (versión optimizada)");
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const videoPath = path.join("temp", `apuesta_${Date.now()}.mp4`);
  const resultImagePath = path.join("temp", `result_${Date.now()}.png`);
  const ffmpegLogPath = "ultimo-log-ffmpeg.log";
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }
  
  // Add timing data file
  const timingId = Date.now();
  const timingDataPath = path.join("temp", `timing_data_${timingId}.json`);
  const timingData = {
    startTime: new Date().toISOString(),
    totalTimeMs: 0,
    simulationPhaseMs: 0,
    renderingPhaseMs: 0,
    videoGenerationMs: 0,
    totalFrames: 0,
    userId: userId,
    chatId: chatId
  };
  
  const WIDTH = 720;
  const HEIGHT = 1280;
  const FPS = 30;
  const GAME_DURATION = 10; // The actual game duration (in seconds)
  const COUNTDOWN_DURATION = 3; // seconds (3, 2, 1)
  const RESULT_DISPLAY_DURATION = 1; // seconds to display the result screen
  const TOTAL_DURATION = GAME_DURATION + COUNTDOWN_DURATION + RESULT_DISPLAY_DURATION;
  const TOTAL_FRAMES = FPS * TOTAL_DURATION;
  const SIMULATION_SPEED = 2; // Speed multiplier for game simulation
  const TEAM_ELEMENTS = 10; // Number of elements per team
  
  // Reset profiler before starting
  profiler.reset();
  
  // Start timing the entire process
  const totalStartTime = performance.now();
  
  try {
    // PHASE 0: Initialization phase (loading assets, setup)
    profiler.start("phase:initialization");
    
    // Load game images before starting
    profiler.start("operation:loadGameImages");
    await ctx.reply("Generando simulación con profiling detallado...");
    const imagesLoaded = await loadGameImages();
    profiler.end("operation:loadGameImages");
    
    // Initialize game parameters
    profiler.start("operation:initializeGameState");
    const gameState = initializeGameState(WIDTH, HEIGHT, TEAM_ELEMENTS, GAME_DURATION);
    gameState.countdownFrames = COUNTDOWN_DURATION * FPS; // Total countdown frames
    gameState.countdown = gameState.countdownFrames; // Current countdown frames remaining
    gameState.initialCountdownFrames = gameState.countdownFrames; // Store initial value for time calculations
    profiler.end("operation:initializeGameState");
    
    profiler.end("phase:initialization");
    
    // Store the total number of frames for timing data
    timingData.totalFrames = TOTAL_FRAMES;
    
    // PHASE 1: Run the entire simulation and store all frame states
    const simulationStartTime = performance.now();
    profiler.start("phase:simulation");
    
    // Arrays to store serialized game states for each frame
    const frameStates = [];
    
    // Pre-compute all simulation states and store serialized versions
    for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
      // Process the frame - this updates the game state
      profiler.start("operation:processFrameSimulation");
      processFrameSimulation(gameState, frameIndex, FPS, SIMULATION_SPEED);
      profiler.end("operation:processFrameSimulation");
      
      // Store a serialized copy of the current state
      profiler.start("util:serializeGameState");
      const serializedState = serializeGameState(gameState);
      frameStates.push(serializedState);
      profiler.end("util:serializeGameState");
      
      // Log progress periodically during simulation
      if (frameIndex % 100 === 0) {
        console.log(`Simulated frame ${frameIndex}/${TOTAL_FRAMES} (${Math.round(frameIndex/TOTAL_FRAMES*100)}%)`);
      }
    }
    
    profiler.end("phase:simulation");
    timingData.simulationPhaseMs = performance.now() - simulationStartTime;
    console.log(`Simulation phase completed in ${timingData.simulationPhaseMs.toFixed(2)}ms`);
    
    // PHASE 2: Set up video generation and render frames
    const renderingStartTime = performance.now();
    profiler.start("phase:rendering");
    
    // Create a log file stream for FFmpeg
    const logStream = fs.createWriteStream(ffmpegLogPath, { flags: 'a' });
    logStream.write(`\n--- FFmpeg log for ${videoPath} (${new Date().toISOString()}) ---\n`);
    
    // Set up FFmpeg process to receive frames directly via stdin pipe
    profiler.start("setup:ffmpeg");
    const ffmpegProcess = spawn('ffmpeg', [
      '-y', // Overwrite output files without asking
      
      // Raw video input settings
      '-f', 'rawvideo',          // Input format is raw video
      '-pixel_format', 'rgb24',  // Input pixel format (RGB, 8 bits per channel)
      '-video_size', `${WIDTH}x${HEIGHT}`, // Input video size
      '-framerate', FPS.toString(), // Input framerate
      '-i', '-',                 // Input from stdin
      
      // Output codec settings (same as before)
      '-c:v', 'libx264',         // H.264 codec
      '-pix_fmt', 'yuv420p',     // Use yuv420p for compatibility
      '-preset', 'veryfast',     // Fast encoding
      '-tune', 'zerolatency',    // Optimize for low latency
      '-crf', '22',              // Quality level
      videoPath                  // Output file
    ]);
    
    // Pipe FFmpeg stderr to our log file
    ffmpegProcess.stderr.on('data', (data) => {
      logStream.write(data);
    });
    
    // Handle potential errors
    ffmpegProcess.on('error', (err) => {
      console.error('FFmpeg process error:', err);
      logStream.write(`\nFFmpeg process error: ${err.message}\n`);
      logStream.end();
    });
    
    // End FFmpeg setup profiling
    profiler.end("setup:ffmpeg");
    
    // End the rendering phase (setup only) before starting video generation
    profiler.end("phase:rendering");
    
    // Calculate rendering phase time (just the setup)
    timingData.renderingPhaseMs = performance.now() - renderingStartTime;
    
    // Start timing video generation as a separate phase
    const videoStartTime = performance.now();
    profiler.start("phase:videoGeneration");
    
    // Create canvas for rendering frames
    profiler.start("setup:canvas");
    const canvas = createCanvas(WIDTH, HEIGHT);
    const context = canvas.getContext('2d');
    profiler.end("setup:canvas");
    
    // Detailed timing data for rendering breakdown
    const renderingBreakdown = {
      renderingTime: 0,
      encodingTime: 0,
      writingTime: 0
    };
    
    // Render each frame from the serialized states
    for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
      // Time for rendering the frame
      profiler.start("operation:clearCanvas");
      context.clearRect(0, 0, WIDTH, HEIGHT);
      profiler.end("operation:clearCanvas");
      
      // Render this frame using the serialized state
      profiler.start("operation:renderFrame");
      renderFrame(context, WIDTH, HEIGHT, FPS, frameStates[frameIndex]);
      profiler.end("operation:renderFrame");
      
      // Get raw pixel data from canvas instead of using PNG conversion
      profiler.start("operation:getRawPixelData");
      const imageData = context.getImageData(0, 0, WIDTH, HEIGHT);
      
      // Convert RGBA to RGB format since FFmpeg expects RGB24 or YUV420P
      // This avoids PNG compression/decompression overhead
      const rgbData = new Uint8Array(WIDTH * HEIGHT * 3); // 3 bytes per pixel (RGB)
      
      // Extract RGB values from RGBA, skipping alpha channel
      for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 3) {
        rgbData[j] = imageData.data[i];     // R
        rgbData[j+1] = imageData.data[i+1]; // G
        rgbData[j+2] = imageData.data[i+2]; // B
        // Skip alpha channel (imageData.data[i+3])
      }
      profiler.end("operation:getRawPixelData");
      
      // Write frame to FFmpeg directly using raw pixel format
      profiler.start("operation:writeToFFmpeg");
      await new Promise((resolve, reject) => {
        if (ffmpegProcess.stdin.writable) {
          const canContinue = ffmpegProcess.stdin.write(rgbData);
          if (!canContinue) {
            ffmpegProcess.stdin.once('drain', resolve);
          } else {
            process.nextTick(resolve);
          }
        } else {
          reject(new Error('FFmpeg stdin is not writable'));
        }
      });
      profiler.end("operation:writeToFFmpeg");
      
      // Log progress periodically
      if (frameIndex % 30 === 0) {
        console.log(`Rendered frame ${frameIndex}/${TOTAL_FRAMES} (${Math.round(frameIndex/TOTAL_FRAMES*100)}%)`);
      }
    }
    
    // Close the FFmpeg input stream to signal we're done sending frames
    profiler.start("operation:finishFFmpeg");
    ffmpegProcess.stdin.end();
    
    // Wait for FFmpeg to finish processing
    await new Promise((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        logStream.write(`\nFFmpeg process exited with code ${code}\n`);
        logStream.end();
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
    profiler.end("operation:finishFFmpeg");
    profiler.end("phase:videoGeneration");
    
    // Calculate video generation time
    timingData.videoGenerationMs = performance.now() - videoStartTime;
    
    // Start a new phase for final image generation
    profiler.start("phase:resultGeneration");
    
    // Generate results image separately (using the final game state)
    profiler.start("operation:generateResultImage");
    const resultCanvas = createCanvas(WIDTH, HEIGHT);
    const resultContext = resultCanvas.getContext('2d');
    drawResultsScreen(resultContext, frameStates[frameStates.length - 1], WIDTH, HEIGHT);
    
    // Save results image
    const resultOut = fs.createWriteStream(resultImagePath);
    const resultStream = resultCanvas.createPNGStream();
    resultStream.pipe(resultOut);
    
    await new Promise((resolve, reject) => {
      resultOut.on('finish', resolve);
      resultOut.on('error', reject);
    });
    profiler.end("operation:generateResultImage");
    
    profiler.end("phase:resultGeneration");
    
    // Start sending phase for the final results
    profiler.start("phase:delivery");
    
    // Send the video and results image
    profiler.start("operation:sendResults");
    await ctx.replyWithVideo(new InputFile(videoPath));
    await ctx.replyWithPhoto(new InputFile(resultImagePath), {
      caption: "Resultado final de la simulación"
    });
    profiler.end("operation:sendResults");
    
    profiler.end("phase:delivery");
    
    // Calculate total time
    const totalTimeMs = performance.now() - totalStartTime;
    timingData.totalTimeMs = totalTimeMs;
    
    // Generate profiling report
    const profilingReport = profiler.generateReport(totalTimeMs);
    
    // Add some statistics
    timingData.stats = {
      framesPerSecond: FPS,
      totalFrames: TOTAL_FRAMES,
      simulationTimePercentage: (timingData.simulationPhaseMs / timingData.totalTimeMs * 100).toFixed(2),
      renderingTimePercentage: (timingData.renderingPhaseMs / timingData.totalTimeMs * 100).toFixed(2),
      videoGenerationTimePercentage: (timingData.videoGenerationMs / timingData.totalTimeMs * 100).toFixed(2),
      profilingData: profilingReport
    };
    
    // Save the timing data to a file
    fs.writeFileSync(timingDataPath, JSON.stringify(timingData, null, 2));
    console.log(`Timing data saved to ${timingDataPath}`);
    
    // Prepare a summary of function timings for display
    const topFunctions = Object.entries(profilingReport.functions)
      .sort((a, b) => parseFloat(b[1].percentageOfTotal) - parseFloat(a[1].percentageOfTotal))
      .slice(0, 10) // Top 10 functions
      .filter(([name]) => !name.includes(' > ')); // Only show root functions in summary
    
    let functionTimingSummary = topFunctions.map(([funcName, data]) => 
      `- ${funcName}: ${(data.totalTimeMs/1000).toFixed(2)}s (${data.percentageOfTotal}%, llamadas: ${data.callCount})`
    ).join('\n');
    
    // Let the user know about the timing data with detailed breakdown
    await ctx.reply(`Simulación optimizada completada en ${(timingData.totalTimeMs/1000).toFixed(2)} segundos.
- Fase de simulación: ${(timingData.simulationPhaseMs/1000).toFixed(2)}s (${timingData.stats.simulationTimePercentage}%)
- Fase de renderizado: ${(timingData.renderingPhaseMs/1000).toFixed(2)}s (${timingData.stats.renderingTimePercentage}%)
- Generación de video: ${(timingData.videoGenerationMs/1000).toFixed(2)}s (${timingData.stats.videoGenerationTimePercentage}%)

TOP 10 FUNCIONES POR TIEMPO DE EJECUCIÓN:
${functionTimingSummary}

Reporte completo guardado en:
- Datos de tiempo y perfil: ${timingDataPath}`);
    
    // Clean up
    fs.unlink(videoPath, (err) => {
      if (err) console.error("Error deleting video file:", err);
    });
    
    fs.unlink(resultImagePath, (err) => {
      if (err) console.error("Error deleting result image file:", err);
    });
    
  } catch (error) {
    console.error("Error generating video:", error);
    await ctx.reply("Ocurrió un error al generar el video de la simulación optimizada.");
    
    // Still try to save timing data even if there was an error
    timingData.error = error.message;
    timingData.totalTimeMs = performance.now() - totalStartTime;
    
    // Also save the profiling data that we collected before the error
    const profilingReport = profiler.generateReport(timingData.totalTimeMs);
    timingData.profilingData = profilingReport;
    
    fs.writeFileSync(timingDataPath, JSON.stringify(timingData, null, 2));
  }
});

/**
 * Converts the game state to a plain serializable object
 * This avoids the issue with structuredClone not preserving methods
 */
function serializeGameState(gameState) {
  profiler.start("util:serializeGameState:properties");
  const serialized = {
    teamCounts: { ...gameState.teamCounts },
    gameTime: gameState.gameTime,
    gameDuration: gameState.gameDuration,
    width: gameState.width,
    height: gameState.height,
    winner: gameState.winner,
    gameOver: gameState.gameOver,
    countdown: gameState.countdown,
    countdownFrames: gameState.countdownFrames,
    initialCountdownFrames: gameState.initialCountdownFrames,
  };
  profiler.end("util:serializeGameState:properties");
  
  profiler.start("util:serializeGameState:entities");
  // Convert entities to plain data objects
  serialized.entities = gameState.entities.map(entity => ({
    type: entity.type,
    x: entity.x,
    y: entity.y,
    radius: entity.radius,
    vx: entity.vx,
    vy: entity.vy,
    captureEffect: entity.captureEffect,
    beingCaptured: entity.beingCaptured
  }));
  profiler.end("util:serializeGameState:entities");
  
  profiler.start("util:serializeGameState:animations");
  // Convert capture animations to plain data objects
  serialized.captureAnimations = gameState.captureAnimations.map(anim => ({
    x: anim.x,
    y: anim.y,
    radius: anim.radius,
    time: anim.time
  }));
  profiler.end("util:serializeGameState:animations");
  
  return serialized;
}

/**
 * Process a single frame's simulation (without rendering)
 */
function processFrameSimulation(gameState, frameIndex, fps, simulationSpeed) {
  const deltaTime = 1 / fps;
  
  // Handle countdown phase
  if (gameState.countdown > 0) {
    gameState.countdown--;
    return;
  }
  
  profiler.start("operation:processFrameSimulation:calculateTime");
  // Calculate game time, excluding the countdown phase completely
  const timeAfterCountdown = frameIndex - gameState.initialCountdownFrames;
  if (timeAfterCountdown >= 0) {
    gameState.gameTime = timeAfterCountdown / fps;
  } else {
    gameState.gameTime = 0;
  }
  profiler.end("operation:processFrameSimulation:calculateTime");
  
  profiler.start("operation:processFrameSimulation:checkGameOver");
  // Check if game over
  if (gameState.gameTime >= gameState.gameDuration && !gameState.gameOver) {
    profiler.start("operation:determineWinner");
    determineWinner(gameState);
    profiler.end("operation:determineWinner");
    gameState.gameOver = true;
  }
  profiler.end("operation:processFrameSimulation:checkGameOver");
  
  // Skip updating the game state if it's game over
  if (!gameState.gameOver) {
    profiler.start("operation:updateGame");
    updateGame(gameState, deltaTime, simulationSpeed);
    profiler.end("operation:updateGame");
  }
}

/**
 * Render a frame from the serialized state
 */
function renderFrame(context, width, height, fps, serializedState) {
  profiler.start("operation:renderFrame:background");
  // Draw background
  context.fillStyle = '#e0e0e0';
  context.fillRect(0, 0, width, height);
  profiler.end("operation:renderFrame:background");
  
  if (serializedState.countdown > 0) {
    // Draw countdown screen
    profiler.start("operation:drawCountdownScreen");
    drawCountdownScreenFromSerialized(context, serializedState, width, height, fps);
    profiler.end("operation:drawCountdownScreen");
  } else if (serializedState.gameOver) {
    // Draw game over screen
    profiler.start("operation:drawResultsScreen");
    drawResultsScreen(context, serializedState, width, height);
    profiler.end("operation:drawResultsScreen");
  } else {
    profiler.start("operation:renderEntities");
    // Draw entities from serialized data
    serializedState.entities.forEach(entity => {
      profiler.start("operation:drawEntity");
      drawEntity(context, entity);
      profiler.end("operation:drawEntity");
    });
    profiler.end("operation:renderEntities");
    
    profiler.start("operation:renderFrame:drawAnimations");
    // Draw capture animations with improved visibility
    serializedState.captureAnimations.forEach(anim => {
      context.beginPath();
      context.arc(anim.x, anim.y, anim.radius * (1 + anim.time), 0, Math.PI * 2);
      context.strokeStyle = `rgba(255, 255, 255, ${anim.time})`;
      context.lineWidth = 4;
      context.stroke();
    });
    profiler.end("operation:renderFrame:drawAnimations");
    
    profiler.start("operation:renderFrame:drawUI");
    // Draw time left
    context.font = 'bold 24px Arial';
    context.fillStyle = '#333333';
    context.textAlign = 'center';
    const timeLeft = Math.max(0, Math.ceil(serializedState.gameDuration - serializedState.gameTime));
    context.fillText(`Tiempo: ${timeLeft}s`, width / 2, 30);
    
    // Draw team counts - all on the left with proper spacing
    context.font = 'bold 24px Arial';
    context.textAlign = 'left';
    context.fillStyle = TEAM_COLORS[TEAM_TYPES.ROCK].stroke;
    context.fillText(`Piedra: ${serializedState.teamCounts[TEAM_TYPES.ROCK]}`, 20, 30);
    
    context.fillStyle = TEAM_COLORS[TEAM_TYPES.PAPER].stroke;
    context.fillText(`Papel: ${serializedState.teamCounts[TEAM_TYPES.PAPER]}`, 20, 60);
    
    context.fillStyle = TEAM_COLORS[TEAM_TYPES.SCISSORS].stroke;
    context.fillText(`Tijera: ${serializedState.teamCounts[TEAM_TYPES.SCISSORS]}`, 20, 90);
    profiler.end("operation:renderFrame:drawUI");
  }
}

// Modify the drawEntity function to use pre-rendered sprites
function drawEntity(ctx, entityData) {
  // Find the closest pre-rendered sprite size
  const radius = entityData.radius;
  const type = entityData.type;
  
  // Get closest pre-rendered radius
  const preRenderedRadii = [10, 15, 20, 21.6, 25, 30];
  let closestRadius = preRenderedRadii[0];
  
  // Find the closest radius in our pre-rendered sprites
  for (const r of preRenderedRadii) {
    if (Math.abs(r - radius) < Math.abs(closestRadius - radius)) {
      closestRadius = r;
    }
  }
  
  // Round coordinates to integers for better performance
  const x = Math.floor(entityData.x);
  const y = Math.floor(entityData.y);
  
  // Sprite key based on type and radius
  const spriteKey = `${type}_${closestRadius}`;
  
  // Draw the pre-rendered sprite if available
  if (spriteCache[spriteKey]) {
    profiler.start("operation:drawEntity:drawPreRendered");
    const sprite = spriteCache[spriteKey];
    // Draw centered on the entity position
    ctx.drawImage(
      sprite, 
      x - sprite.width/2, 
      y - sprite.height/2
    );
    profiler.end("operation:drawEntity:drawPreRendered");
  } else {
    // Fallback to the old method in case the sprite is not in the cache
    profiler.start("operation:drawEntity:background");
    const colors = TEAM_COLORS[entityData.type];
    
    // Draw circle background
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.stroke;
    ctx.stroke();
    profiler.end("operation:drawEntity:background");
    
    profiler.start("operation:drawEntity:image");
    // Draw image instead of text
    if (imageCache[entityData.type]) {
      const img = imageCache[entityData.type];
      const imgSize = radius * 1.8; // Slightly larger than radius
      ctx.drawImage(img, x - imgSize/2, y - imgSize/2, imgSize, imgSize);
    } else {
      // Fallback if image not loaded
      ctx.font = `${radius * 1.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.stroke;
      
      let text = '';
      if (entityData.type === TEAM_TYPES.ROCK) text = 'R';
      else if (entityData.type === TEAM_TYPES.PAPER) text = 'P';
      else text = 'S';
      
      ctx.fillText(text, x, y);
    }
    profiler.end("operation:drawEntity:image");
  }
  
  // Draw capture effect if active
  if (entityData.captureEffect > 0) {
    profiler.start("operation:drawEntity:captureEffect");
    
    // Get closest effect strength (rounded to 0.1)
    const effectStrength = Math.round(entityData.captureEffect * 10) / 10;
    // Find closest pre-rendered effect
    const effectKey = `capture_${closestRadius}_${effectStrength.toFixed(1)}`;
    
    if (spriteCache[effectKey]) {
      // Use pre-rendered effect
      const effectSprite = spriteCache[effectKey];
      ctx.drawImage(
        effectSprite,
        x - effectSprite.width/2,
        y - effectSprite.height/2
      );
    } else {
      // Fallback to drawing the effect directly
      ctx.beginPath();
      ctx.arc(x, y, radius * (1 + entityData.captureEffect * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${entityData.captureEffect})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    profiler.end("operation:drawEntity:captureEffect");
  }
}

/**
 * Draw countdown screen using serialized entity data
 */
function drawCountdownScreenFromSerialized(ctx, serializedState, width, height, fps) {
  // Clear the canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw background
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, width, height);
  
  // Draw all entities but without movement
  serializedState.entities.forEach(entity => {
    drawEntity(ctx, entity);
  });
  
  // Draw the countdown number
  const countdownSeconds = Math.ceil(serializedState.countdown / fps);
  let countdownImage;
  
  if (countdownSeconds === 3) {
    countdownImage = imageCache['countdown_3'];
  } else if (countdownSeconds === 2) {
    countdownImage = imageCache['countdown_2'];
  } else if (countdownSeconds === 1) {
    countdownImage = imageCache['countdown_1'];
  } else {
    countdownImage = imageCache['countdown_go'];
  }
  
  // Draw the countdown image or fallback to text
  if (countdownImage) {
    const imgSize = Math.min(width, height) * 0.3;
    ctx.drawImage(countdownImage, (width - imgSize) / 2, (height - imgSize) / 2, imgSize, imgSize);
  } else {
    // Fallback to text
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 96px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      countdownSeconds > 0 ? countdownSeconds.toString() : '¡YA!', 
      width / 2, 
      height / 2
    );
  }
}

function initializeGameState(width, height, teamElements, gameDuration) {
  // Initialize game state
  const state = {
    entities: [],
    captureAnimations: [],
    teamCounts: {
      [TEAM_TYPES.ROCK]: 0,
      [TEAM_TYPES.PAPER]: 0,
      [TEAM_TYPES.SCISSORS]: 0,
    },
    gameTime: 0,
    gameDuration: gameDuration,
    width: width,
    height: height,
    lastFrameTime: 0,
    winner: null,
    gameOver: false,
    countdownFrames: 0, // Will be set in the command function
    capturingEntities: new Set() // Track entities that are currently being captured
  };
  
  // Create initial entities with guaranteed separation
  const attemptLimit = 100; // Prevent infinite loops
  
  for (const type of [TEAM_TYPES.ROCK, TEAM_TYPES.PAPER, TEAM_TYPES.SCISSORS]) {
    for (let i = 0; i < teamElements; i++) {
      let attempts = 0;
      let entityCreated = false;
      
      while (!entityCreated && attempts < attemptLimit) {
        attempts++;
        
        const entity = createEntityAtRandomPosition(state, type);
        
        // Check if this entity overlaps with any existing entities
        const hasOverlap = state.entities.some(existingEntity => {
          const dx = entity.x - existingEntity.x;
          const dy = entity.y - existingEntity.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          // Ensure they're at least 2.5 radii apart
          return distance < (entity.radius + existingEntity.radius) * 2.5;
        });
        
        if (!hasOverlap) {
          // Add the entity to the game state if there's no overlap
          state.entities.push(entity);
          state.teamCounts[type]++;
          entityCreated = true;
        }
      }
      
      if (!entityCreated) {
        console.warn(`Couldn't place entity ${i} of type ${type} after ${attemptLimit} attempts`);
      }
    }
  }
  
  return state;
}

function createEntityAtRandomPosition(state, type) {
  // Position randomly, away from edges
  const margin = state.width * 0.1;
  const x = margin + Math.random() * (state.width - 2 * margin);
  const y = margin + Math.random() * (state.height - 2 * margin);
  
  // Create entity but don't add it to state yet (will be done after overlap check)
  return new Entity(type, x, y, state.width);
}

// Game Entity Class
class Entity {
  constructor(type, x, y, stateWidth) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = stateWidth * 0.03; // Responsive size
    this.vx = (Math.random() * 2 - 1) * (stateWidth * 0.15);
    this.vy = (Math.random() * 2 - 1) * (stateWidth * 0.15);
    this.captureEffect = 0;
    this.beingCaptured = false;
  }

  update(state, deltaTime, simulationSpeed) {
    // Don't update if we're still in countdown
    if (state.countdown > 0) {
      return;
    }
    
    // Apply simulation speed multiplier
    const adjustedDeltaTime = deltaTime * simulationSpeed;
    
    // Move based on velocity
    this.x += this.vx * adjustedDeltaTime;
    this.y += this.vy * adjustedDeltaTime;

    // Wall collisions
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = -this.vx;
    } else if (this.x + this.radius > state.width) {
      this.x = state.width - this.radius;
      this.vx = -this.vx;
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = -this.vy;
    } else if (this.y + this.radius > state.height) {
      this.y = state.height - this.radius;
      this.vy = -this.vy;
    }

    // Update capture effect (fade out) - increased fade speed
    if (this.captureEffect > 0) {
      this.captureEffect -= adjustedDeltaTime * 4;
      if (this.captureEffect < 0) {
        this.captureEffect = 0;
        // Reset the being captured flag
        this.beingCaptured = false;
        // Remove from the capturing entities set
        state.capturingEntities.delete(this);
      }
    }
  }

  draw(ctx) {
    const colors = TEAM_COLORS[this.type];
    
    // Draw circle background
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors.stroke;
    ctx.stroke();
    
    // Draw image instead of text
    if (imageCache[this.type]) {
      const img = imageCache[this.type];
      const imgSize = this.radius * 1.8; // Slightly larger than radius
      ctx.drawImage(img, this.x - imgSize/2, this.y - imgSize/2, imgSize, imgSize);
    } else {
      // Fallback if image not loaded
      ctx.font = `${this.radius * 1.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.stroke;
      
      let text = '';
      if (this.type === TEAM_TYPES.ROCK) text = 'R';
      else if (this.type === TEAM_TYPES.PAPER) text = 'P';
      else text = 'S';
      
      ctx.fillText(text, this.x, this.y);
    }
    
    // Draw capture effect if active
    if (this.captureEffect > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * (1 + this.captureEffect * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.captureEffect})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  collidesWith(other) {
    // Don't check collisions if we're still in countdown
    if (this.beingCaptured || other.beingCaptured) {
      return false;
    }
    
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + other.radius;
  }

  resolveCollision(other) {
    // Calculate collision normal
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normal vector (points from this entity to the other entity)
    const nx = dx / distance;
    const ny = dy / distance;

    // Calculate dot product of velocity and normal (projection of velocity onto normal)
    const dotProductThis = this.vx * nx + this.vy * ny;
    const dotProductOther = other.vx * nx + other.vy * ny;

    // Reflect velocities based on the normal vector
    // Formula: v' = v - 2(v·n)n
    this.vx = this.vx - 2 * (dotProductThis * nx);
    this.vy = this.vy - 2 * (dotProductThis * ny);
    other.vx = other.vx - 2 * (dotProductOther * nx);
    other.vy = other.vy - 2 * (dotProductOther * ny);

    // Separate objects to prevent overlap
    const overlap = this.radius + other.radius - distance;
    if (overlap > 0) {
      this.x -= (overlap / 2) * nx;
      this.y -= (overlap / 2) * ny;
      other.x += (overlap / 2) * nx;
      other.y += (overlap / 2) * ny;
    }
  }

  capture(state, newType) {
    // Don't allow already captured entities to be captured again
    if (this.beingCaptured || state.capturingEntities.has(this)) {
      return;
    }
    
    // Reduce count for old type
    state.teamCounts[this.type]--;

    // Update type
    this.type = newType;

    // Increase count for new type
    state.teamCounts[newType]++;

    // Add capture effect - set to maximum strength
    this.captureEffect = 1.0;
    this.beingCaptured = true;
    state.capturingEntities.add(this);

    // Add capture animation
    state.captureAnimations = state.captureAnimations.filter(anim => anim.entity !== this);
    state.captureAnimations.push({
      x: this.x,
      y: this.y,
      radius: this.radius,
      time: 1.0,
      entity: this
    });
  }
}

function updateGame(state, deltaTime, simulationSpeed) {
  profiler.start("operation:updateGame:entities");
  // Update entities
  state.entities.forEach(entity => {
    profiler.start("operation:entity.update");
    entity.update(state, deltaTime, simulationSpeed);
    profiler.end("operation:entity.update");
  });
  profiler.end("operation:updateGame:entities");
  
  profiler.start("operation:updateGame:collisions");
  // Check for collisions
  for (let i = 0; i < state.entities.length; i++) {
    for (let j = i + 1; j < state.entities.length; j++) {
      const entityA = state.entities[i];
      const entityB = state.entities[j];
      
      profiler.start("operation:entity.collidesWith");
      const isColliding = entityA.collidesWith(entityB);
      profiler.end("operation:entity.collidesWith");
      
      if (isColliding) {
        profiler.start("operation:handleCollision");
        handleCollision(state, entityA, entityB);
        profiler.end("operation:handleCollision");
      }
    }
  }
  profiler.end("operation:updateGame:collisions");
  
  profiler.start("operation:updateGame:animations");
  // Update capture animations
  state.captureAnimations = state.captureAnimations.filter(anim => {
    anim.time -= deltaTime * simulationSpeed * 6;
    return anim.time > 0;
  });
  profiler.end("operation:updateGame:animations");
}

function handleCollision(state, entityA, entityB) {
  // Handle same type
  if (entityA.type === entityB.type) {
    entityA.resolveCollision(entityB);
  }
  // Rock beats Scissors
  else if (
    entityA.type === TEAM_TYPES.ROCK &&
    entityB.type === TEAM_TYPES.SCISSORS
  ) {
    entityB.capture(state, TEAM_TYPES.ROCK);
    entityA.resolveCollision(entityB);
  } else if (
    entityB.type === TEAM_TYPES.ROCK &&
    entityA.type === TEAM_TYPES.SCISSORS
  ) {
    entityA.capture(state, TEAM_TYPES.ROCK);
    entityA.resolveCollision(entityB);
  }
  // Scissors beats Paper
  else if (
    entityA.type === TEAM_TYPES.SCISSORS &&
    entityB.type === TEAM_TYPES.PAPER
  ) {
    entityB.capture(state, TEAM_TYPES.SCISSORS);
    entityA.resolveCollision(entityB);
  } else if (
    entityB.type === TEAM_TYPES.SCISSORS &&
    entityA.type === TEAM_TYPES.PAPER
  ) {
    entityA.capture(state, TEAM_TYPES.SCISSORS);
    entityA.resolveCollision(entityB);
  }
  // Paper beats Rock
  else if (
    entityA.type === TEAM_TYPES.PAPER &&
    entityB.type === TEAM_TYPES.ROCK
  ) {
    entityB.capture(state, TEAM_TYPES.PAPER);
    entityA.resolveCollision(entityB);
  } else if (
    entityB.type === TEAM_TYPES.PAPER &&
    entityA.type === TEAM_TYPES.ROCK
  ) {
    entityA.capture(state, TEAM_TYPES.PAPER);
    entityA.resolveCollision(entityB);
  }
}

function determineWinner(state) {
  const rockCount = state.teamCounts[TEAM_TYPES.ROCK];
  const paperCount = state.teamCounts[TEAM_TYPES.PAPER];
  const scissorsCount = state.teamCounts[TEAM_TYPES.SCISSORS];
  
  if (rockCount > paperCount && rockCount > scissorsCount) {
    state.winner = TEAM_TYPES.ROCK;
  } else if (paperCount > rockCount && paperCount > scissorsCount) {
    state.winner = TEAM_TYPES.PAPER;
  } else if (scissorsCount > rockCount && scissorsCount > paperCount) {
    state.winner = TEAM_TYPES.SCISSORS;
  } else {
    state.winner = "tie";
  }
}

function drawCountdownScreen(ctx, state, width, height, fps) {
  // Clear the canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw background
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, width, height);
  
  // Draw all entities but without movement
  state.entities.forEach(entity => entity.draw(ctx));
  
  // Draw the countdown number
  const countdownSeconds = Math.ceil(state.countdown / fps);
  let countdownImage;
  
  if (countdownSeconds === 3) {
    countdownImage = imageCache['countdown_3'];
  } else if (countdownSeconds === 2) {
    countdownImage = imageCache['countdown_2'];
  } else if (countdownSeconds === 1) {
    countdownImage = imageCache['countdown_1'];
  } else {
    countdownImage = imageCache['countdown_go'];
  }
  
  // Draw the countdown image or fallback to text
  if (countdownImage) {
    const imgSize = Math.min(width, height) * 0.3;
    ctx.drawImage(countdownImage, (width - imgSize) / 2, (height - imgSize) / 2, imgSize, imgSize);
  } else {
    // Fallback to text
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 96px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      countdownSeconds > 0 ? countdownSeconds.toString() : '¡YA!', 
      width / 2, 
      height / 2
    );
  }
}

function drawResultsScreen(ctx, state, width, height) {
  // Draw background
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, width, height);
  
  // Draw title
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'center';
  
  let resultText = "";
  
  if (state.winner === TEAM_TYPES.ROCK) {
    resultText = "¡Equipo Piedra gana!";
    ctx.fillStyle = TEAM_COLORS[TEAM_TYPES.ROCK].stroke;
  } else if (state.winner === TEAM_TYPES.PAPER) {
    resultText = "¡Equipo Papel gana!";
    ctx.fillStyle = TEAM_COLORS[TEAM_TYPES.PAPER].stroke;
  } else if (state.winner === TEAM_TYPES.SCISSORS) {
    resultText = "¡Equipo Tijera gana!";
    ctx.fillStyle = TEAM_COLORS[TEAM_TYPES.SCISSORS].stroke;
  } else {
    resultText = "¡Empate!";
    ctx.fillStyle = '#333333';
  }
  
  ctx.fillText(resultText, width / 2, height / 3);
  
  // Draw winner image
  if (state.winner !== "tie" && imageCache[state.winner]) {
    const imgSize = width * 0.2;
    ctx.drawImage(
      imageCache[state.winner],
      (width - imgSize) / 2,
      height / 3 + 20,
      imgSize,
      imgSize
    );
  }
  
  // Draw team counts
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#333333';
  ctx.fillText("Recuento final:", width / 2, height / 2);
  
  ctx.font = '32px Arial';
  const rockColor = TEAM_COLORS[TEAM_TYPES.ROCK].stroke;
  const paperColor = TEAM_COLORS[TEAM_TYPES.PAPER].stroke;
  const scissorsColor = TEAM_COLORS[TEAM_TYPES.SCISSORS].stroke;
  
  // Draw team counts with icons
  const countsY = height / 2 + 60;
  const iconSize = 40;
  const spacing = 70;
  
  // Rock count
  ctx.fillStyle = rockColor;
  if (imageCache[TEAM_TYPES.ROCK]) {
    ctx.drawImage(
      imageCache[TEAM_TYPES.ROCK],
      width / 2 - 150,
      countsY,
      iconSize,
      iconSize
    );
    ctx.fillText(`Piedra: ${state.teamCounts[TEAM_TYPES.ROCK]}`, width / 2, countsY + 20);
  } else {
    ctx.fillText(`Piedra: ${state.teamCounts[TEAM_TYPES.ROCK]}`, width / 2, countsY);
  }
  
  // Paper count
  ctx.fillStyle = paperColor;
  if (imageCache[TEAM_TYPES.PAPER]) {
    ctx.drawImage(
      imageCache[TEAM_TYPES.PAPER],
      width / 2 - 150,
      countsY + spacing,
      iconSize,
      iconSize
    );
    ctx.fillText(`Papel: ${state.teamCounts[TEAM_TYPES.PAPER]}`, width / 2, countsY + spacing + 20);
  } else {
    ctx.fillText(`Papel: ${state.teamCounts[TEAM_TYPES.PAPER]}`, width / 2, countsY + spacing);
  }
  
  // Scissors count
  ctx.fillStyle = scissorsColor;
  if (imageCache[TEAM_TYPES.SCISSORS]) {
    ctx.drawImage(
      imageCache[TEAM_TYPES.SCISSORS],
      width / 2 - 150,
      countsY + spacing * 2,
      iconSize,
      iconSize
    );
    ctx.fillText(`Tijera: ${state.teamCounts[TEAM_TYPES.SCISSORS]}`, width / 2, countsY + spacing * 2 + 20);
  } else {
    ctx.fillText(`Tijera: ${state.teamCounts[TEAM_TYPES.SCISSORS]}`, width / 2, countsY + spacing * 2);
  }
}
