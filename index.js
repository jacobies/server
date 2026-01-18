import express from 'express';
import 'dotenv/config';

const app = express();
app.use(express.json());

const SECRET_KEY = 'my_secure_key_12345';
const PORT = process.env.PORT || 3000;

// Store pending commands for Roblox to pick up
let pendingCommands = {};

// Store results from Roblox
let commandResults = {};

// POST: Discord bot sends command here
app.post('/execute-command', (req, res) => {
  const { action, targetGameId, secretKey, commandId, discordUser, timestamp } = req.body;

  console.log('Received command:', { action, targetGameId, secretKey, commandId });

  // Validate secret key
  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid secret key' });
  }

  // Validate target game ID (this is the correct field name from Discord bot)
  if (!targetGameId || !/^\d+$/.test(targetGameId)) {
    console.log('Invalid targetGameId:', targetGameId);
    return res.json({ success: false, message: 'Invalid game ID' });
  }

  // Store command for Roblox script to pick up
  pendingCommands[targetGameId] = {
    action,
    targetGameId,
    commandId,
    discordUser,
    timestamp,
    executed: false
  };

  console.log(`📩 Command queued for game ${targetGameId}: ${action}`);

  // Return immediately, Roblox will execute and update status
  return res.json({ 
    success: true, 
    message: 'Command queued',
    commandId,
    playerCount: 0,
    queued: true
  });
});

// GET: Roblox script checks for pending commands
app.get('/check-command/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  const command = pendingCommands[gameId];

  if (command && !command.executed) {
    command.executed = true;
    console.log(`✅ Command sent to Roblox game ${gameId}`);
    return res.json({ 
      success: true, 
      hasCommand: true,
      command 
    });
  }

  return res.json({ 
    success: true, 
    hasCommand: false 
  });
});

// GET: Get target game info (for teleporting)
app.get('/get-target-game/:targetGameId', (req, res) => {
  const targetGameId = req.params.targetGameId;
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  // Return target game ID (can be expanded with more game info)
  return res.json({ 
    success: true, 
    targetGameId: targetGameId,
    teleportUrl: `https://www.roblox.com/games/${targetGameId}`
  });
});

// POST: Roblox script reports command result
app.post('/report-result', (req, res) => {
  const { gameId, commandId, action, success, playerCount, message, secretKey } = req.body;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  // Store result
  commandResults[commandId] = {
    gameId,
    action,
    success,
    playerCount,
    message,
    timestamp: Date.now()
  };

  // Clean up pending command
  if (pendingCommands[gameId]) {
    delete pendingCommands[gameId];
  }

  console.log(`📊 Result received from game ${gameId}: ${action} - ${message}`);

  return res.json({ 
    success: true, 
    message: 'Result recorded',
    playerCount,
    action
  });
});

// GET: Discord bot checks result (optional, for more advanced implementation)
app.get('/check-result/:commandId', (req, res) => {
  const commandId = req.params.commandId;
  const result = commandResults[commandId];

  if (result) {
    return res.json({ success: true, result });
  }

  return res.json({ success: false, message: 'Result not found' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    pendingCommands: Object.keys(pendingCommands).length,
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Server URL: http://localhost:${PORT}`);
});
