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

// Store saveinstance file data
let saveinstanceFiles = {};

// POST: Roblox script uploads file
app.post('/upload-saveinstance', (req, res) => {
  const { commandId, discordUserId, filename, fileData, secretKey } = req.body;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid secret key' });
  }

  if (!commandId || !fileData || !filename) {
    return res.json({ success: false, message: 'Missing required fields' });
  }

  // Store file data
  saveinstanceFiles[commandId] = {
    filename,
    fileData,
    discordUserId,
    timestamp: Date.now()
  };

  console.log(`📁 File stored: ${filename} (${(fileData.length / 1024 / 1024).toFixed(2)}MB)`);

  return res.json({ 
    success: true, 
    message: 'File uploaded'
  });
});

// GET: Discord bot retrieves file
app.get('/get-saveinstance-file/:commandId', (req, res) => {
  const commandId = req.params.commandId;
  const secretKey = req.query.key;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  const file = saveinstanceFiles[commandId];

  if (file) {
    delete saveinstanceFiles[commandId]; // Delete after retrieval
    return res.json({ 
      success: true, 
      file 
    });
  }

  return res.json({ success: false, message: 'File not found' });
});

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
    // Don't clear it yet - only clear after the script reports it received it
    console.log(`📬 Sending saveinstance command to Roblox script`);
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

// POST: Script acknowledges it received the command
app.post('/ack-saveinstance', (req, res) => {
  const { commandId, secretKey } = req.body;

  if (secretKey !== SECRET_KEY) {
    return res.json({ success: false, message: 'Invalid key' });
  }

  // Now clear the command since it was received
  if (saveinstanceCommand && saveinstanceCommand.commandId === commandId) {
    saveinstanceCommand = null;
    console.log(`✅ Command ${commandId} acknowledged by script`);
  }

  return res.json({ success: true, message: 'Acknowledged' });
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
