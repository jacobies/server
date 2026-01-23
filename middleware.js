const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

let currentCommand = null;
let latestFile = null; // Store the latest saved file
const chunkStorage = new Map(); // Temporary storage for chunked uploads

app.use(cors());
app.use(express.json({ limit: '500mb' })); // Increased limit for large files
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.get('/', (req, res) => {
    res.json({ 
        status: 'running', 
        service: 'Roblox SaveInstance Middleware',
        hasCommand: !!currentCommand,
        hasFile: !!latestFile,
        filePlaceId: latestFile ? latestFile.placeId : null
    });
});

app.get('/get-command', (req, res) => {
    console.log('[Middleware] GET /get-command - Current command:', currentCommand);
    
    if (currentCommand) {
        const cmd = { ...currentCommand }; // Copy the command
        console.log('[Middleware] Sending command:', cmd);
        
        // DON'T clear execute commands immediately - they need to persist after teleport
        if (cmd.command !== 'saveinstance_execute') {
            console.log('[Middleware] Clearing non-execute command after sending');
            currentCommand = null;
        }
        
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
    
    currentCommand = { command, placeId, options: options || {} };
    console.log('[Middleware] NEW COMMAND SET:', currentCommand);
    
    res.json({ success: true, message: 'Command queued' });
});

app.post('/set-execute-mode', (req, res) => {
    const { placeId, options } = req.body;
    currentCommand = { command: 'saveinstance_execute', placeId: placeId, options: options || {} };
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

// NEW: Clear file storage endpoint
app.post('/clear-file', (req, res) => {
    const previousFile = latestFile ? `${latestFile.fileName} (PlaceID: ${latestFile.placeId})` : 'none';
    console.log('[Middleware] CLEAR FILE - Previous file:', previousFile);
    latestFile = null;
    console.log('[Middleware] File storage cleared');
    res.json({ success: true, cleared: true, previousFile });
});

app.post('/acknowledge', (req, res) => {
    console.log('[Middleware] Command acknowledged:', req.body);
    // Clear execute command after acknowledgment
    if (currentCommand && currentCommand.command === 'saveinstance_execute') {
        console.log('[Middleware] Clearing execute command after acknowledgment');
        currentCommand = null;
    }
    res.json({ success: true });
});

// CHUNKED UPLOAD HANDLER
app.post('/upload-chunk', (req, res) => {
    try {
        const { fileName, fileData, placeId, chunkIndex, totalChunks } = req.body;
        
        if (!fileName || !fileData || !chunkIndex || !totalChunks) {
            return res.status(400).json({ error: 'Missing required chunk data' });
        }
        
        console.log(`[Middleware] 📦 Chunk ${chunkIndex}/${totalChunks} for ${fileName} (PlaceID: ${placeId})`);
        
        // Create unique key for this file upload
        const uploadKey = `${placeId}_${fileName}`;
        
        // Initialize chunk array if first chunk
        if (!chunkStorage.has(uploadKey)) {
            chunkStorage.set(uploadKey, {
                chunks: new Array(totalChunks),
                fileName: fileName,
                placeId: placeId,
                receivedCount: 0,
                timestamp: Date.now()
            });
            console.log(`[Middleware] 🆕 Started new chunked upload: ${uploadKey}`);
        }
        
        const upload = chunkStorage.get(uploadKey);
        
        // Store this chunk
        upload.chunks[chunkIndex - 1] = fileData;
        upload.receivedCount++;
        
        console.log(`[Middleware] ✅ Chunk ${chunkIndex}/${totalChunks} stored (${upload.receivedCount}/${totalChunks} received)`);
        
        // If all chunks received, combine and store
        if (upload.receivedCount === totalChunks) {
            console.log(`[Middleware] 🔄 All chunks received! Combining file...`);
            
            // Combine all chunks
            const completeBase64 = upload.chunks.join('');
            
            // Store as latest file
            const previousPlaceId = latestFile ? latestFile.placeId : 'none';
            
            latestFile = { 
                fileName: fileName, 
                fileData: completeBase64, 
                placeId: placeId || null, 
                timestamp: Date.now() 
            };
            
            const fileSizeKB = Math.round(completeBase64.length / 1024);
            const fileSizeMB = (fileSizeKB / 1024).toFixed(2);
            
            console.log(`[Middleware] ✅ File combined: ${fileName}`);
            console.log(`[Middleware] PlaceId: ${placeId} (previous: ${previousPlaceId})`);
            console.log(`[Middleware] Size: ${fileSizeKB} KB (${fileSizeMB} MB base64)`);
            
            // Clean up chunk storage
            chunkStorage.delete(uploadKey);
            console.log(`[Middleware] 🗑️ Cleaned up chunk storage for ${uploadKey}`);
            
            res.json({ success: true, message: 'File uploaded and combined successfully' });
        } else {
            res.json({ success: true, message: `Chunk ${chunkIndex}/${totalChunks} received` });
        }
        
    } catch (error) {
        console.error('[Middleware] ❌ Chunk upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ORIGINAL UPLOAD ENDPOINT (keep for backwards compatibility)
app.post('/upload-file', (req, res) => {
    const { fileName, fileData, placeId } = req.body;
    
    if (!fileName || !fileData) {
        return res.status(400).json({ error: 'Missing fileName or fileData' });
    }
    
    const previousPlaceId = latestFile ? latestFile.placeId : 'none';
    
    latestFile = { fileName, fileData, placeId: placeId || null, timestamp: Date.now() };
    
    console.log('[Middleware] File uploaded:', fileName);
    console.log('[Middleware] PlaceId:', placeId, '(previous:', previousPlaceId + ')');
    console.log('[Middleware] Size:', Math.round(fileData.length / 1024), 'KB (base64)');
    
    res.json({ success: true, message: 'File stored' });
});

app.get('/get-latest-file', (req, res) => {
    if (latestFile) {
        console.log('[Middleware] Sending latest file:', latestFile.fileName, 'PlaceId:', latestFile.placeId);
        res.json({ success: true, ...latestFile });
    } else {
        console.log('[Middleware] No file available');
        res.json({ success: false, message: 'No file available' });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'running', 
        hasCommand: !!currentCommand,
        hasFile: !!latestFile,
        filePlaceId: latestFile ? latestFile.placeId : null,
        activeChunkedUploads: chunkStorage.size
    });
});

// Cleanup old incomplete uploads periodically
setInterval(() => {
    const now = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes
    
    for (const [key, upload] of chunkStorage.entries()) {
        if (now - upload.timestamp > timeout) {
            console.log(`[Middleware] 🗑️ Cleaning up stale upload: ${key} (${upload.receivedCount}/${upload.chunks.length} chunks received)`);
            chunkStorage.delete(key);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Middleware] Server running on port ${PORT}`);
    console.log('[Middleware] Waiting for commands...');
});
