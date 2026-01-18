import express from 'express';
import 'dotenv/config';

const app = express();
app.use(express.json());

const SECRET_KEY = 'my_secure_key_12345';
const PORT = process.env.PORT || 3000;

// Store the latest broadcast command
let broadcastCommand = null;

// Store results from Roblox
let commandResults = {};

// POST: Discord bot broadcasts command to all scripts
app.post('/broadcast-teleport', (req, res) => {
  const { targetGameId, secretKey, commandId, discordUser } = req.body;

  console.log('Received broadcast:', { targetGameId, secretKey, commandId });

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid secret key' });
  }

  if (!targetGameId || !/^\d+$/.test(targetGameId)) {
    return res.json({ success: false, message: 'Invalid target game ID' });
  }

  // Store command for ANY script to pick up
  broadcastCommand = {
    action: 'teleport_and_save',
    targetGameId,
    commandId,
    discordUser,
    timestamp: Date.now()
  };

  console.log(`📢 Broadcast command: Teleport to game ${targetGameId}`);

  return res.json({ 
    success: true, 
    message: 'Broadcast sent',
    commandId
  });
});

// GET: Roblox script gets the latest broadcast command
app.get('/get-broadcast', (req, res) => {
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  if (broadcastCommand) {
    const cmd = broadcastCommand;
    broadcastCommand = null; // Clear after sending
    console.log(`📬 Sent broadcast command to Roblox script`);
    return res.json({ 
      success: true, 
      hasCommand: true,
      command: cmd
    });
  }

  return res.json({ 
    success: true, 
    hasCommand: false 
  });
});

// POST: Roblox script reports command result
app.post('/report-result', (req, res) => {
  const { gameId, commandId, action, success, playerName, message, secretKey } = req.body;

  console.log('Received result:', { gameId, commandId, action, success });

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  // Store result
  commandResults[commandId] = {
    gameId,
    action,
    success,
    playerName,
    message,
    timestamp: Date.now()
  };

  console.log(`✅ Result recorded: ${playerName} - ${message}`);

  return res.json({ 
    success: true, 
    message: 'Result recorded',
    playerName,
    action
  });
});

// GET: Discord bot checks result
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
    hasBroadcast: broadcastCommand !== null,
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
