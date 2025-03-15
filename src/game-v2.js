import {Composer, InputFile} from "grammy";

export const apuesta2 = new Composer();
import * as path from "path";
import * as fs from "fs";
import {createCanvas, loadImage} from 'canvas';
import {spawn} from 'child_process';
import {performance} from 'perf_hooks';
import {Profiler} from './utils/profiler.js';
import {Entity} from './utils/entity.js';

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
const WIDTH = 720;
const HEIGHT = 1280;

const RADIUS_SIZE = 21.6;

// Cache for loaded images
const imageCache = {};
// Cache for pre-rendered entity sprites
const spriteCache = {};

// Cache for rendered result screen
let cachedResultScreen = null;


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
            fs.mkdirSync(resourcesPath, {recursive: true});
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
// TODO: Es posible que no tenga que precargar las imagenes cada vez, ya que son variables generales/globales del archivo, y el archivo se carga una vez se ejecuta el npm start
// Add a new function to pre-render entity sprites
async function preRenderEntitySprites() {
    // Cargar las imagenes antes de convertilas en canvas
    profiler.start("loadGameImages");
    await loadGameImages();
    profiler.end("loadGameImages");


    // Pre-render sprites for each entity type and size
    for (const type of [TEAM_TYPES.ROCK, TEAM_TYPES.PAPER, TEAM_TYPES.SCISSORS]) {
        const colors = TEAM_COLORS[type];
        const img = imageCache[type];

        if (!img) continue; // Skip if image not loaded


        // Create an identifier for this sprite
        // The keys will be used as identifiers like "rock_21.6" for a rock with radius 21.6
        const spriteKey = `${type}_${RADIUS_SIZE}`;

        // Create a small canvas just for this sprite
        const spriteCanvas = createCanvas(RADIUS_SIZE * 4, RADIUS_SIZE * 4); // Make canvas big enough
        const spriteCtx = spriteCanvas.getContext('2d');

        // Clear the canvas
        // spriteCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);

        // Draw the circle background
        const centerX = spriteCanvas.width / 2;
        const centerY = spriteCanvas.height / 2;

        spriteCtx.beginPath();
        spriteCtx.arc(centerX, centerY, RADIUS_SIZE, 0, Math.PI * 2);
        spriteCtx.fillStyle = colors.fill;
        spriteCtx.fill();
        spriteCtx.lineWidth = 2;
        spriteCtx.strokeStyle = colors.stroke;
        spriteCtx.stroke();

        // Draw the image on top
        const imgSize = RADIUS_SIZE * 1.8; // Same sizing as in drawEntity
        spriteCtx.drawImage(img, centerX - imgSize / 2, centerY - imgSize / 2, imgSize, imgSize);

        // Store the pre-rendered sprite
        spriteCache[spriteKey] = spriteCanvas;

    }

    // Also pre-render capture effect sprites
    for (let effectStrength = 0.2; effectStrength <= 1.0; effectStrength += 0.2) {
        const effectKey = `capture_${RADIUS_SIZE}_${effectStrength.toFixed(1)}`;

        const effectCanvas = createCanvas(RADIUS_SIZE * 6, RADIUS_SIZE * 6);
        const effectCtx = effectCanvas.getContext('2d');

        const centerX = effectCanvas.width / 2;
        const centerY = effectCanvas.height / 2;

        effectCtx.beginPath();
        effectCtx.arc(centerX, centerY, RADIUS_SIZE * (1 + effectStrength * 0.5), 0, Math.PI * 2);
        effectCtx.strokeStyle = `rgba(255, 255, 255, ${effectStrength})`;
        effectCtx.lineWidth = 3;
        effectCtx.stroke();

        spriteCache[effectKey] = effectCanvas;
    }

    console.log(`Pre-rendered ${Object.keys(spriteCache).length} sprites`);
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
        fs.mkdirSync('temp', {recursive: true});
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
        await ctx.reply("Generando simulación con profiling detallado...");
        // PHASE 0: Initialization phase (loading assets, setup)
        profiler.start("initialization");

        // Load game images before starting
        profiler.start("preRenderEntitySprites");
        await preRenderEntitySprites();
        profiler.end("preRenderEntitySprites");

        // Initialize game parameters
        profiler.start("initializeGameState");
        const gameState = initializeGameState(WIDTH, HEIGHT, TEAM_ELEMENTS, GAME_DURATION);
        gameState.countdownFrames = COUNTDOWN_DURATION * FPS; // Total countdown frames
        gameState.countdown = gameState.countdownFrames; // Current countdown frames remaining
        gameState.initialCountdownFrames = gameState.countdownFrames; // Store initial value for time calculations
        profiler.end("initializeGameState");

        profiler.end("initialization");

        // Store the total number of frames for timing data
        timingData.totalFrames = TOTAL_FRAMES;

        // PHASE 1: Run the entire simulation and store all frame states
        const simulationStartTime = performance.now();
        profiler.start("simulation");

        // Arrays to store serialized game states for each frame
        const frameStates = [];

        // Pre-compute all simulation states and store serialized versions
        for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
            // Process the frame - this updates the game state
            profiler.start("processFrameSimulation");
            processFrameSimulation(gameState, frameIndex, FPS, SIMULATION_SPEED);
            profiler.end("processFrameSimulation");

            // Store a serialized copy of the current state
            // TODO: Este profiler es medio irrisorio, utilizarlo de ejemplo de jerarquia
            profiler.start("serializeGameState");
            const serializedState = serializeGameState(gameState);
            frameStates.push(serializedState);
            profiler.end("serializeGameState");

            // Log progress periodically during simulation
            if (frameIndex % 100 === 0) {
                console.log(`Simulated frame ${frameIndex}/${TOTAL_FRAMES} (${Math.round(frameIndex / TOTAL_FRAMES * 100)}%)`);
            }
        }

        profiler.end("simulation");
        timingData.simulationPhaseMs = performance.now() - simulationStartTime;
        console.log(`Simulation phase completed in ${timingData.simulationPhaseMs.toFixed(2)}ms`);

        // PHASE 2: Set up video generation and render frames

        // Create a log file stream for FFmpeg
        const logStream = fs.createWriteStream(ffmpegLogPath, {flags: 'a'});
        logStream.write(`\n--- FFmpeg log for ${videoPath} (${new Date().toISOString()}) ---\n`);

        // Set up FFmpeg process to receive frames directly via stdin pipe
        profiler.start("setupFfmpeg");
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
        profiler.end("setupFfmpeg");


        // Create canvas for rendering frames
        profiler.start("canvas");
        const canvas = createCanvas(WIDTH, HEIGHT);
        const context = canvas.getContext('2d', { alpha: false });
        profiler.end("canvas");


        const renderingStartTime = performance.now();
        profiler.start("rendering");

        // Generar aqui el frame de  y guardarlo en el sprite cache
        profiler.start("drawResultsScreen");
        cachedResultScreen = drawResultsScreen(frameStates[frameStates.length - 1], WIDTH, HEIGHT);
        profiler.end("drawResultsScreen");

        // Render each frame from the serialized states
        for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex++) {
            // Render this frame using the serialized state
            profiler.start("renderFrame");
            renderFrame(context, WIDTH, HEIGHT, FPS, frameStates[frameIndex]);
            profiler.end("renderFrame");

            // Get raw pixel data from canvas instead of using PNG conversion
            profiler.start("getRawPixelData");
            profiler.start("getImageData");
            const imageData = context.getImageData(0, 0, WIDTH, HEIGHT);
            profiler.end("getImageData");

            // Convert RGBA to RGB format since FFmpeg expects RGB24 or YUV420P
            // Using the most optimized approach possible
            profiler.start("rgbData");
            const rgba = imageData.data;
            const totalPixels = WIDTH * HEIGHT;
            const rgbData = new Uint8Array(totalPixels * 3); // 3 bytes per pixel (RGB)
            profiler.end("rgbData");
            
            profiler.start("bucleRgbData");
            // Process in large chunks directly using flat indices
            // This eliminates multiplication operations inside the inner loop
            let rgbIndex = 0;
            let rgbaIndex = 0;
            
            // Unrolled loop with direct array access for better performance
            // Process 8 pixels per iteration for better CPU utilization
            const UNROLL_SIZE = 8;
            const unrolledLimit = totalPixels - (totalPixels % UNROLL_SIZE);
            
            for (let i = 0; i < unrolledLimit; i += UNROLL_SIZE) {
                // Pixel 1
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 2
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 3
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 4
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 5
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 6
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 7
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
                
                // Pixel 8
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
            }
            
            // Handle any remaining pixels
            for (let i = unrolledLimit; i < totalPixels; i++) {
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbData[rgbIndex++] = rgba[rgbaIndex++];
                rgbaIndex++; // Skip alpha
            }
            
            profiler.end("bucleRgbData");
            profiler.end("getRawPixelData");

            // Write frame to FFmpeg directly using raw pixel format
            profiler.start("writeToFFmpeg");
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
            profiler.end("writeToFFmpeg");

            // Log progress periodically
            if (frameIndex % 30 === 0) {
                console.log(`Rendered frame ${frameIndex}/${TOTAL_FRAMES} (${Math.round(frameIndex / TOTAL_FRAMES * 100)}%)`);
            }
        }

        // Close the FFmpeg input stream to signal we're done sending frames
        ffmpegProcess.stdin.end();

        // End the rendering phase (setup only) before starting video generation
        profiler.end("rendering");
        // Calculate rendering phase time (just the setup)
        timingData.renderingPhaseMs = performance.now() - renderingStartTime;


        // Start timing video generation as a separate phase
        const videoStartTime = performance.now();
        profiler.start("videoGeneration");


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

        profiler.end("videoGeneration");

        // Calculate video generation time
        timingData.videoGenerationMs = performance.now() - videoStartTime;

        // Start a new phase for final image generation
        profiler.start("resultGeneration");

        // Generate results image separately (using the final game state)
        profiler.start("generateResultImage");
        // Save results image
        const resultOut = fs.createWriteStream(resultImagePath);
        const resultStream = cachedResultScreen.createPNGStream();
        resultStream.pipe(resultOut);

        await new Promise((resolve, reject) => {
            resultOut.on('finish', resolve);
            resultOut.on('error', reject);
        });
        profiler.end("generateResultImage");

        profiler.end("resultGeneration");


        // Calculate total time
        const totalTimeMs = performance.now() - totalStartTime;
        timingData.totalTimeMs = totalTimeMs;

        // Send the video and results image
        await ctx.replyWithVideo(new InputFile(videoPath));
        await ctx.replyWithPhoto(new InputFile(resultImagePath), {
            caption: "Resultado final de la simulación"
        });


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


        // Let the user know about the timing data with detailed breakdown
        await ctx.reply(`Generación optimizada completada en ${(timingData.totalTimeMs / 1000).toFixed(2)} segundos. Reporte completo guardado en: ${timingDataPath}`);

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
        timingData.profilingData = profiler.generateReport(timingData.totalTimeMs);

        fs.writeFileSync(timingDataPath, JSON.stringify(timingData, null, 2));
    }
});

/**
 * Converts the game state to a plain serializable object
 * This avoids the issue with structuredClone not preserving methods
 */
function serializeGameState(gameState) {
    profiler.start("properties");
    const serialized = {
        teamCounts: {...gameState.teamCounts},
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
    profiler.end("properties");

    profiler.start("entities");
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
    profiler.end("entities");

    profiler.start("animations");
    // Convert capture animations to plain data objects
    serialized.captureAnimations = gameState.captureAnimations.map(anim => ({
        x: anim.x,
        y: anim.y,
        radius: anim.radius,
        time: anim.time
    }));
    profiler.end("animations");

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

    profiler.start("calculateTime");
    // Calculate game time, excluding the countdown phase completely
    const timeAfterCountdown = frameIndex - gameState.initialCountdownFrames;
    if (timeAfterCountdown >= 0) {
        gameState.gameTime = timeAfterCountdown / fps;
    } else {
        gameState.gameTime = 0;
    }
    profiler.end("calculateTime");

    profiler.start("checkGameOver");
    // Check if game over
    if (gameState.gameTime >= gameState.gameDuration && !gameState.gameOver) {
        profiler.start("determineWinner");
        determineWinner(gameState);
        profiler.end("determineWinner");
        gameState.gameOver = true;
    }
    profiler.end("checkGameOver");

    // Skip updating the game state if it's game over
    if (!gameState.gameOver) {
        profiler.start("updateGame");
        updateGame(gameState, deltaTime, simulationSpeed);
        profiler.end("updateGame");
    }
}

/**
 * Render a frame from the serialized state
 */
function renderFrame(context, width, height, fps, serializedState) {
    if (serializedState.countdown > 0) {
        // Draw countdown screen
        profiler.start("drawCountdownScreen");
        drawCountdownScreenFromSerialized(context, serializedState, width, height, fps);
        profiler.end("drawCountdownScreen");
    } else if (serializedState.gameOver) {
        // Draw game over screen
        profiler.start("renderResultImage");
        // TODO: creo que se puede optimizar aun mas el dibujo de la pantalla de resultados y del contador pero
        // supondria rehacer la funcion render frame y la padre tambien
        context.drawImage(cachedResultScreen, 0, 0);
        profiler.end("renderResultImage");
    } else {
        // Draw background
        profiler.start("background");
        context.fillStyle = '#e0e0e0';
        context.fillRect(0, 0, WIDTH, HEIGHT);
        profiler.end("background");


        profiler.start("renderEntities");
        // Draw entities from serialized data
        serializedState.entities.forEach(entity => {
            profiler.start("drawEntity");
            drawEntity(context, entity);
            profiler.end("drawEntity");
        });
        profiler.end("renderEntities");

        profiler.start("drawAnimations");
        // Draw capture animations with improved visibility
        serializedState.captureAnimations.forEach(anim => {
            context.beginPath();
            context.arc(anim.x, anim.y, anim.radius * (1 + anim.time), 0, Math.PI * 2);
            context.strokeStyle = `rgba(255, 255, 255, ${anim.time})`;
            context.lineWidth = 4;
            context.stroke();
        });
        profiler.end("drawAnimations");

        profiler.start("drawUI");
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
        profiler.end("drawUI");
    }
}

// Modify the drawEntity function to use pre-rendered sprites
function drawEntity(ctx, entityData) {
    const type = entityData.type;

    // Round coordinates to integers for better performance
    const x = Math.floor(entityData.x);
    const y = Math.floor(entityData.y);

    // Sprite key based on type and radius
    const spriteKey = `${type}_${RADIUS_SIZE}`;

    // Draw the pre-rendered sprite if available
    if (spriteCache[spriteKey]) {
        profiler.start("drawPreRendered");
        profiler.start("getSprite");
        const sprite = spriteCache[spriteKey];
        profiler.end("getSprite");
        // Draw centered on the entity position
        profiler.start("drawImage");
        ctx.drawImage(
            sprite,
            x - sprite.width / 2,
            y - sprite.height / 2
        );
        profiler.end("drawImage");
        profiler.end("drawPreRendered");
    } else {
        // TODO: Añadir un profiler
        // Fallback to the old method, draw only the letter
        const colors = TEAM_COLORS[entityData.type];

        // Draw circle background
        ctx.beginPath();
        ctx.arc(x, y, RADIUS_SIZE, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.stroke;
        ctx.stroke();
        // Fallback if image not loaded
        ctx.font = `${RADIUS_SIZE * 1.2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = colors.stroke;

        let text;
        if (entityData.type === TEAM_TYPES.ROCK) text = 'R';
        else if (entityData.type === TEAM_TYPES.PAPER) text = 'P';
        else text = 'S';

        ctx.fillText(text, x, y);
    }

    // Draw capture effect if active
    if (entityData.captureEffect > 0) {
        profiler.start("captureEffect");

        // Get closest effect strength (rounded to 0.1)
        const effectStrength = Math.round(entityData.captureEffect * 10) / 10;
        // Find pre-rendered effect
        const effectKey = `capture_${RADIUS_SIZE}_${effectStrength.toFixed(1)}`;

        if (spriteCache[effectKey]) {
            // Use pre-rendered effect
            const effectSprite = spriteCache[effectKey];
            ctx.drawImage(
                effectSprite,
                x - effectSprite.width / 2,
                y - effectSprite.height / 2
            );
        } else {
            // Fallback to drawing the effect directly
            ctx.beginPath();
            ctx.arc(x, y, RADIUS_SIZE * (1 + entityData.captureEffect * 0.5), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${entityData.captureEffect})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        profiler.end("captureEffect");
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

    // Draw the countdown number
    const countdownSeconds = Math.ceil(serializedState.countdown / fps);
    let countdownImage;

    // TODO: usar lso sprites, aunque a lo mejor no hacer falta con el nuevo aproach
    // El nuevo es guardar la imagen de contador por completo y luego utilizarla
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

function updateGame(state, deltaTime, simulationSpeed) {
    profiler.start("entities");
    // Update entities
    state.entities.forEach(entity => {
        profiler.start("entity.update");
        entity.update(state, deltaTime, simulationSpeed);
        profiler.end("entity.update");
    });
    profiler.end("entities");

    profiler.start("collisions");
    // Check for collisions
    for (let i = 0; i < state.entities.length; i++) {
        for (let j = i + 1; j < state.entities.length; j++) {
            const entityA = state.entities[i];
            const entityB = state.entities[j];

            profiler.start("entity.collidesWith");
            const isColliding = entityA.collidesWith(entityB);
            profiler.end("entity.collidesWith");

            if (isColliding) {
                profiler.start("handleCollision");
                handleCollision(state, entityA, entityB);
                profiler.end("handleCollision");
            }
        }
    }
    profiler.end("collisions");

    profiler.start("animations");
    // Update capture animations
    state.captureAnimations = state.captureAnimations.filter(anim => {
        anim.time -= deltaTime * simulationSpeed * 6;
        return anim.time > 0;
    });
    profiler.end("animations");
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


function drawResultsScreen(state, width, height) {
    // Dibujar en canvas y guardar en cached img
    const resultCanvas = createCanvas(WIDTH, HEIGHT);
    const ctx = resultCanvas.getContext("2d");

    // Draw background
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, width, height);

    // Draw title
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';

    let resultText;

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
    if (spriteCache[`${TEAM_TYPES.ROCK}_${RADIUS_SIZE}`]) {
        ctx.drawImage(
            spriteCache[`${TEAM_TYPES.ROCK}_${RADIUS_SIZE}`],
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
    if (spriteCache[`${TEAM_TYPES.PAPER}_${RADIUS_SIZE}`]) {
        ctx.drawImage(
            spriteCache[`${TEAM_TYPES.PAPER}_${RADIUS_SIZE}`],
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
    if (spriteCache[`${TEAM_TYPES.SCISSORS}_${RADIUS_SIZE}`]) {
        ctx.drawImage(
            spriteCache[`${TEAM_TYPES.SCISSORS}_${RADIUS_SIZE}`],
        width / 2 - 150,
            countsY + spacing * 2,
            iconSize,
            iconSize
        );
        ctx.fillText(`Tijera: ${state.teamCounts[TEAM_TYPES.SCISSORS]}`, width / 2, countsY + spacing * 2 + 20);
    } else {
        ctx.fillText(`Tijera: ${state.teamCounts[TEAM_TYPES.SCISSORS]}`, width / 2, countsY + spacing * 2);
    }

    return resultCanvas;
}
