const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

let currentCommand = null;
let commandRetrieved = false; // Track if execute command has been retrieved
let latestFile = null; // Store the latest saved file

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        status: 'running', 
        service: 'Roblox SaveInstance Middleware',
        hasCommand: !!currentCommand 
    });
});

app.get('/get-command', (req, res) => {
    if (currentCommand) {
        console.log('[Middleware] Sending command to Roblox client:', currentCommand);
        const cmd = currentCommand;
        
        // If it's an execute command and it's been retrieved before, clear it
        if (cmd.command === 'saveinstance_execute' && commandRetrieved) {
            console.log('[Middleware] Execute command already retrieved once, clearing it');
            currentCommand = null;
            commandRetrieved = false;
            res.json({});
            return;
        }
        
        // Mark execute commands as retrieved
        if (cmd.command === 'saveinstance_execute') {
            commandRetrieved = true;
        }
        
        res.json(cmd);
    } else {
        res.json({});
    }
});

app.post('/send-command', (req, res) => {
    const { command, placeId, options } = req.body;
    
    if (!command || !placeId) {
        return res.status(400).json({ error: 'Missing command or placeId' });
    }
    
    currentCommand = { command, placeId, options: options || {} };
    commandRetrieved = false; // Reset retrieval flag
    console.log('[Middleware] Received command from Discord:', currentCommand);
    
    res.json({ success: true, message: 'Command queued' });
});

app.post('/set-execute-mode', (req, res) => {
    const { options, placeId } = req.body;
    currentCommand = { command: 'saveinstance_execute', options: options || {}, placeId: placeId };
    commandRetrieved = false; // Reset retrieval flag for new execute command
    console.log('[Middleware] Set to execute mode with options:', options, 'and placeId:', placeId);
    res.json({ success: true });
});

app.post('/clear-command', (req, res) => {
    console.log('[Middleware] Clearing command. Previous command was:', currentCommand);
    currentCommand = null;
    commandRetrieved = false;
    console.log('[Middleware] Command cleared. Current command is now:', currentCommand);
    res.json({ success: true, cleared: true });
});

app.post('/acknowledge', (req, res) => {
    console.log('[Middleware] Command acknowledged:', req.body);
    res.json({ success: true });
});

app.post('/upload-file', (req, res) => {
    const { fileName, fileData } = req.body;
    
    if (!fileName || !fileData) {
        return res.status(400).json({ error: 'Missing fileName or fileData' });
    }
    
    latestFile = { fileName, fileData, timestamp: Date.now() };
    console.log('[Middleware] File uploaded:', fileName);
    res.json({ success: true, message: 'File stored' });
});

app.get('/get-latest-file', (req, res) => {
    if (latestFile) {
        console.log('[Middleware] Sending latest file:', latestFile.fileName);
        res.json({ success: true, ...latestFile });
    } else {
        res.json({ success: false, message: 'No file available' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'running', hasCommand: !!currentCommand });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Middleware] Server running on port ${PORT}`);
    console.log('[Middleware] Waiting for commands...');
});
