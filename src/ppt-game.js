import { Composer, InputFile } from "grammy";
export const apuesta = new Composer();
import * as path from "path";
import * as fs from "fs";
import { createCanvas, loadImage, Image } from 'canvas';
import { spawn } from 'child_process';

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
    text: "🪨",
  },
  [TEAM_TYPES.PAPER]: {
    fill: "#e0e0ff",
    stroke: "#9090ff",
    text: "📄",
  },
  [TEAM_TYPES.SCISSORS]: {
    fill: "#ff9e9e",
    stroke: "#e05555",
    text: "✂️",
  },
};

// Cache for loaded images
const imageCache = {};

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

    return true;
  } catch (error) {
    console.error("Error loading game images:", error);
    return false;
  }
}

apuesta.command("apuesta", async (ctx) => {
  console.log("Ejecutando apuesta");
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const videoPath = path.join("temp", `apuesta_${Date.now()}.mp4`);
  const framesDir = path.join("temp", `frames_${Date.now()}`);
  const resultImagePath = path.join("temp", `result_${Date.now()}.png`);
  const ffmpegLogPath = "ultimo-log-ffmpeg.log";
  
  // Create directories if they don't exist
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  
  if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp', { recursive: true });
  }
  
  const WIDTH = 720;
  const HEIGHT = 1280;
  const FPS = 30;
  const GAME_DURATION = 10; // The actual game duration (in seconds)
  const COUNTDOWN_DURATION = 3; // seconds (3, 2, 1)
  const RESULT_DISPLAY_DURATION = 1; // seconds to display the result screen
  const TOTAL_DURATION = GAME_DURATION + COUNTDOWN_DURATION + RESULT_DISPLAY_DURATION;
  const TOTAL_FRAMES = FPS * TOTAL_DURATION;
  const SIMULATION_SPEED = 1.5; // Speed multiplier for game simulation
  
  try {
    // Load game images before starting
    await ctx.reply("Generando simulación...");
    const imagesLoaded = await loadGameImages();
    
    // Initialize game parameters
    const teamElements = 10;
    const gameState = initializeGameState(WIDTH, HEIGHT, teamElements, GAME_DURATION);
    gameState.countdownFrames = COUNTDOWN_DURATION * FPS; // Total countdown frames
    gameState.countdown = gameState.countdownFrames; // Current countdown frames remaining
    gameState.initialCountdownFrames = gameState.countdownFrames; // Store initial value for time calculations
    
    // Use a Promise.all approach to generate frames in batches for better performance
    const batchSize = 10;
    const batches = Math.ceil(TOTAL_FRAMES / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const startFrame = batch * batchSize;
      const endFrame = Math.min(startFrame + batchSize, TOTAL_FRAMES);
      
      await Promise.all(
        Array.from({ length: endFrame - startFrame }, (_, i) => {
          const frameIndex = startFrame + i;
          return generateFrame(frameIndex, framesDir, WIDTH, HEIGHT, FPS, TOTAL_FRAMES, gameState, SIMULATION_SPEED);
        })
      );
    }
    
    // Generate results image separately
    const resultCanvas = createCanvas(WIDTH, HEIGHT);
    const resultContext = resultCanvas.getContext('2d');
    drawResultsScreen(resultContext, gameState, WIDTH, HEIGHT);
    
    // Save results image
    const resultOut = fs.createWriteStream(resultImagePath);
    const resultStream = resultCanvas.createPNGStream();
    resultStream.pipe(resultOut);
    
    await new Promise((resolve, reject) => {
      resultOut.on('finish', resolve);
      resultOut.on('error', reject);
    });
    
    // Use ffmpeg to combine frames into video
    await generateVideoWithFFmpeg(framesDir, videoPath, FPS, ffmpegLogPath);
    
    // Send the video and results image
    await ctx.replyWithVideo(new InputFile(videoPath));
    await ctx.replyWithPhoto(new InputFile(resultImagePath), {
      caption: "Resultado final de la simulación"
    });
    
    // Clean up
    fs.rm(framesDir, { recursive: true, force: true }, (err) => {
      if (err) console.error("Error removing frame directory:", err);
    });
    
    fs.unlink(videoPath, (err) => {
      if (err) console.error("Error deleting video file:", err);
    });
    
    fs.unlink(resultImagePath, (err) => {
      if (err) console.error("Error deleting result image file:", err);
    });
    
  } catch (error) {
    console.error("Error generating video:", error);
    await ctx.reply("Ocurrió un error al generar el video de la simulación.");
  }
});

async function generateFrame(frameIndex, framesDir, width, height, fps, totalFrames, gameState, simulationSpeed) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  const playhead = frameIndex / totalFrames;
  
  // Call the rendering function
  const renderer = myVideo();
  renderer({ 
    canvas, 
    context, 
    width, 
    height, 
    playhead,
    frameIndex,
    fps,
    gameState,
    simulationSpeed
  });
  
  // Save the frame
  const framePath = path.join(framesDir, `frame_${frameIndex.toString().padStart(6, '0')}.png`);
  const out = fs.createWriteStream(framePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  
  return new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

async function generateVideoWithFFmpeg(framesDir, outputPath, fps, logPath) {
  return new Promise((resolve, reject) => {
    // Create a log file stream
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n--- FFmpeg log for ${outputPath} (${new Date().toISOString()}) ---\n`);
    
    const ffmpeg = spawn('ffmpeg', [
      '-framerate', fps.toString(),
      '-i', path.join(framesDir, 'frame_%06d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '22',
      outputPath
    ]);
    
    ffmpeg.stderr.on('data', data => {
      // Write to log file instead of console
      logStream.write(data);
    });
    
    ffmpeg.on('close', code => {
      logStream.write(`\nFFmpeg process exited with code ${code}\n`);
      logStream.end();
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on('error', err => {
      logStream.write(`\nFFmpeg process error: ${err.message}\n`);
      logStream.end();
      reject(err);
    });
  });
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

function myVideo() {
  // provide a function to draw video frames
  return function ({ canvas, context, width, height, playhead, frameIndex, fps, gameState, simulationSpeed }) {
    const deltaTime = 1 / fps;
    
    // Handle countdown phase
    if (gameState.countdown > 0) {
      // Draw countdown screen
      drawCountdownScreen(context, gameState, width, height, fps);
      gameState.countdown--;
      return;
    }
    
    // Calculate game time, excluding the countdown phase completely
    // This ensures the game gets its full duration regardless of countdown
    const timeAfterCountdown = frameIndex - gameState.initialCountdownFrames;
    if (timeAfterCountdown >= 0) {
      gameState.gameTime = timeAfterCountdown / fps;
    } else {
      gameState.gameTime = 0; // Shouldn't happen but just in case
    }
    
    // Check if game over
    if (gameState.gameTime >= gameState.gameDuration && !gameState.gameOver) {
      determineWinner(gameState);
      gameState.gameOver = true;
    }
    
    // Clear canvas
    context.clearRect(0, 0, width, height);
    
    // Draw background
    context.fillStyle = '#e0e0e0';
    context.fillRect(0, 0, width, height);
    
    if (gameState.gameOver) {
      // Draw game over screen
      drawResultsScreen(context, gameState, width, height);
    } else {
      // Update game state
      updateGame(gameState, deltaTime, simulationSpeed);
      
      // Draw entities
      gameState.entities.forEach(entity => entity.draw(context));
      
      // Draw capture animations with improved visibility
      gameState.captureAnimations.forEach(anim => {
        context.beginPath();
        context.arc(anim.x, anim.y, anim.radius * (1 + anim.time), 0, Math.PI * 2);
        context.strokeStyle = `rgba(255, 255, 255, ${anim.time})`;
        context.lineWidth = 4;
        context.stroke();
      });
      
      // Draw time left
      context.font = 'bold 24px Arial';
      context.fillStyle = '#333333';
      context.textAlign = 'center';
      const timeLeft = Math.max(0, Math.ceil(gameState.gameDuration - gameState.gameTime));
      context.fillText(`Tiempo: ${timeLeft}s`, width / 2, 30);
      
      // Draw team counts - all on the left with proper spacing
      context.font = 'bold 24px Arial';
      context.textAlign = 'left';
      context.fillStyle = TEAM_COLORS[TEAM_TYPES.ROCK].stroke;
      context.fillText(`Piedra: ${gameState.teamCounts[TEAM_TYPES.ROCK]}`, 20, 30);
      
      context.fillStyle = TEAM_COLORS[TEAM_TYPES.PAPER].stroke;
      context.fillText(`Papel: ${gameState.teamCounts[TEAM_TYPES.PAPER]}`, 20, 60);
      
      context.fillStyle = TEAM_COLORS[TEAM_TYPES.SCISSORS].stroke;
      context.fillText(`Tijera: ${gameState.teamCounts[TEAM_TYPES.SCISSORS]}`, 20, 90);
    }
  };
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

function updateGame(state, deltaTime, simulationSpeed) {
  // Don't update if we're still in countdown
  if (state.countdown > 0) {
    return;
  }
  
  // Update entities
  state.entities.forEach(entity => entity.update(state, deltaTime, simulationSpeed));
  
  // Check for collisions
  for (let i = 0; i < state.entities.length; i++) {
    for (let j = i + 1; j < state.entities.length; j++) {
      const entityA = state.entities[i];
      const entityB = state.entities[j];
      
      if (entityA.collidesWith(entityB)) {
        handleCollision(state, entityA, entityB);
      }
    }
  }
  
  // Update capture animations - faster fading for better visuals
  state.captureAnimations = state.captureAnimations.filter(anim => {
    anim.time -= deltaTime * simulationSpeed * 6;
    return anim.time > 0;
  });
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
