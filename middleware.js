const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const CONFIG_FILE_PATH = '/Users/jacobmorgan/Documents/Macsploit Workspace/saveinstance_config.json';

let currentCommand = null;
let latestFile = null; // Store the latest saved file

app.use(cors());
app.use(express.json());

// Function to update config file with new options
function updateConfigFile(options) {
    try {
        // Read existing config or create default
        let config = {
            saveinstance_options: {
                ShowStatus: true,
                AntiIdle: true,
                IgnoreDefaultProperties: true,
                IgnoreNotArchivable: true,
                RemovePlayerCharacters: true,
                SaveNotCreatable: false,
                IgnoreSpecialProperties: false,
                AlternativeWritefile: true,
                IgnoreDefaultPlayerScripts: true,
                IgnoreSharedStrings: true
            },
            workspace_path: "/Users/jacobmorgan/Documents/Macsploit Workspace"
        };

        // Check if file exists and read it
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
            config = JSON.parse(fileContent);
        }

        // Update with new options from Discord
        config.saveinstance_options = {
            ...config.saveinstance_options,
            ...options
        };

        // Write updated config back to file
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
        console.log('[Middleware] Config file updated with options:', options);
        return true;
    } catch (error) {
        console.error('[Middleware] Error updating config file:', error);
        return false;
    }
}

app.get('/', (req, res) => {
    res.json({ 
        status: 'running', 
        service: 'Roblox SaveInstance Middleware',
        hasCommand: !!currentCommand 
    });
});

app.get('/get-command', (req, res) => {
    console.log('[Middleware] GET /get-command - Current command:', currentCommand);
    
    if (currentCommand) {
        const cmd = { ...currentCommand }; // Copy the command
        console.log('[Middleware] Sending command:', cmd);
        
        // IMMEDIATELY clear it after sending
        console.log('[Middleware] Clearing command after sending');
        currentCommand = null;
        
        res.json(cmd);
    } else {
        console.log('[Middleware] No command available');
        res.json({});
    }
});

app.post('/send-command', (req, res) => {
    const { command, placeId, options } = req.body;
    
    if (!command || !placeId) {
        return res.status(400).json({ error: 'Missing command or placeId' });
    }
    
    // Update config file with options from Discord
    if (options) {
        const configUpdated = updateConfigFile(options);
        if (!configUpdated) {
            console.warn('[Middleware] Failed to update config file, but continuing...');
        }
    }
    
    currentCommand = { command, placeId };
    console.log('[Middleware] NEW COMMAND SET:', currentCommand);
    console.log('[Middleware] Options written to config file');
    
    res.json({ success: true, message: 'Command queued' });
});

app.post('/set-execute-mode', (req, res) => {
    const { placeId } = req.body;
    currentCommand = { command: 'saveinstance_execute', placeId: placeId };
    console.log('[Middleware] SET EXECUTE MODE:', currentCommand);
    res.json({ success: true });
});

app.post('/clear-command', (req, res) => {
    console.log('[Middleware] MANUAL CLEAR - Previous command:', currentCommand);
    currentCommand = null;
    console.log('[Middleware] Command cleared');
    res.json({ success: true, cleared: true });
});

app.get('/clear-command', (req, res) => {
    console.log('[Middleware] GET CLEAR - Previous command:', currentCommand);
    currentCommand = null;
    console.log('[Middleware] Command cleared via GET');
    res.json({ success: true, cleared: true, message: 'Command cleared!' });
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
