const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

let currentCommand = null;

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
    console.log('[Middleware] Received command from Discord:', currentCommand);
    
    res.json({ success: true, message: 'Command queued' });
});

app.post('/set-execute-mode', (req, res) => {
    const { options } = req.body;
    currentCommand = { command: 'saveinstance_execute', options: options || {} };
    console.log('[Middleware] Set to execute mode with options:', options);
    res.json({ success: true });
});

app.post('/clear-command', (req, res) => {
    console.log('[Middleware] Command cleared:', req.body);
    currentCommand = null;
    res.json({ success: true });
});

app.post('/acknowledge', (req, res) => {
    console.log('[Middleware] Command acknowledged:', req.body);
    res.json({ success: true });
});

app.get('/health', (req, res) => {
    res.json({ status: 'running', hasCommand: !!currentCommand });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Middleware] Server running on port ${PORT}`);
    console.log('[Middleware] Waiting for commands...');
});
