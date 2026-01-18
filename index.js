import express from 'express';
import 'dotenv/config';

const app = express();
app.use(express.json());

const SECRET_KEY = 'my_secure_key_12345';
const PORT = process.env.PORT || 3000;

// Store the latest teleport command
let broadcastCommand = null;

// Store the latest saveinstance command
let saveinstanceCommand = null;

// Store saveinstance results with file info
let saveinstanceResults = {};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    hasBroadcast: broadcastCommand !== null,
    hasSaveCommand: saveinstanceCommand !== null,
    uptime: process.uptime()
  });
});

// POST: Discord bot broadcasts teleport command
app.post('/broadcast-teleport', (req, res) => {
  const { targetGameId, secretKey, commandId, discordUser } = req.body;

  console.log('Received broadcast teleport:', { targetGameId, secretKey, commandId });

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid secret key' });
  }

  if (!targetGameId || !/^\d+$/.test(targetGameId)) {
    return res.json({ success: false, message: 'Invalid target game ID' });
  }

  broadcastCommand = {
    action: 'teleport_and_save',
    targetGameId,
    commandId,
    discordUser,
    timestamp: Date.now()
  };

  console.log(`📢 Broadcast teleport command: ${targetGameId}`);

  return res.json({ 
    success: true, 
    message: 'Broadcast sent',
    commandId
  });
});

// GET: Roblox script gets teleport command
app.get('/get-broadcast', (req, res) => {
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  if (broadcastCommand) {
    const cmd = broadcastCommand;
    broadcastCommand = null;
    console.log(`📬 Sent teleport command to Roblox script`);
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

// POST: Discord bot broadcasts saveinstance command
app.post('/broadcast-saveinstance', (req, res) => {
  const { action, gameId, secretKey, commandId, discordUser, discordUserId, options } = req.body;

  console.log('Received broadcast saveinstance:', { gameId, commandId, options });

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid secret key' });
  }

  if (!gameId || !/^\d+$/.test(gameId)) {
    return res.json({ success: false, message: 'Invalid game ID' });
  }

  saveinstanceCommand = {
    action: 'saveinstance',
    gameId,
    commandId,
    discordUser,
    discordUserId,
    options: options || {},
    timestamp: Date.now()
  };

  console.log(`📢 SaveInstance command queued for game ${gameId}`);

  return res.json({ 
    success: true, 
    message: 'SaveInstance command queued',
    commandId
  });
});

// GET: Auto-execute script gets saveinstance command
app.get('/get-saveinstance-command', (req, res) => {
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  if (saveinstanceCommand) {
    const cmd = saveinstanceCommand;
    saveinstanceCommand = null;
    console.log(`📬 Sent saveinstance command to Roblox script`);
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

// POST: Auto-execute script reports saveinstance result
app.post('/report-saveinstance', (req, res) => {
  const { commandId, success, gameId, discordUserId, filename, message, secretKey } = req.body;

  console.log('Received saveinstance result:', { commandId, success, filename });

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  // Store result with file info
  saveinstanceResults[commandId] = {
    success,
    gameId,
    discordUserId,
    filename,
    message,
    timestamp: Date.now()
  };

  console.log(`✅ SaveInstance result recorded: ${message}`);

  return res.json({ 
    success: true, 
    message: 'Result recorded'
  });
});

// GET: Discord bot checks saveinstance result
app.get('/get-saveinstance-result/:commandId', (req, res) => {
  const commandId = req.params.commandId;
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  const result = saveinstanceResults[commandId];

  if (result) {
    return res.json({ success: true, result });
  }

  return res.json({ success: false, message: 'Result not found' });
});

// POST: Roblox script reports result
app.post('/report-result', (req, res) => {
  const { gameId, commandId, action, success, playerName, message, secretKey } = req.body;

  console.log('Received result:', { gameId, commandId, action, success });

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  console.log(`✅ Result recorded: ${playerName} - ${message}`);

  return res.json({ 
    success: true, 
    message: 'Result recorded',
    playerName,
    action
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
