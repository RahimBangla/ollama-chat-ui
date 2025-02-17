const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3100;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

// Enable CORS for all origins and methods
app.use(cors({
    origin: '*', // Allow all origins
    credentials: true, // Allow credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: '*', // Allow all headers
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: true,
    optionsSuccessStatus: 204
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Trust proxy settings
app.set('trust proxy', true);
app.enable('trust proxy');

// Allow larger request bodies
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));

// Add security headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    // Add Content Security Policy header to prevent mixed content
    res.header('Content-Security-Policy', "upgrade-insecure-requests");
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

// Handle /api/generate specifically
app.post('/api/generate', async (req, res) => {
    try {
        const response = await axios({
            method: 'POST',
            url: `${OLLAMA_URL}/api/generate`,
            data: req.body,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 600000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            responseType: 'stream'
        });

        response.data.pipe(res);
        
        // Log the response chunks
        let responseData = '';
        response.data.on('data', (chunk) => {
            responseData += chunk;
            console.log('Response chunk:', chunk.toString());
        });
        
        response.data.on('end', () => {
            console.log('Complete response:', responseData);
        });

    } catch (error) {
        console.error('Ollama Generate API Error:', error.message);
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error || error.message;
        
        res.status(statusCode).json({
            error: "Failed to generate from Ollama API",
            details: errorMessage
        });
    }
});

// Handle /api/tags specifically
app.get('/api/tags', async (req, res) => {
    try {
        const response = await axios({
            method: 'GET',
            url: `${OLLAMA_URL}/api/tags`,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        res.json(response.data);
    } catch (error) {
        console.error('Ollama Tags API Error:', error.message);
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error || error.message;
        
        res.status(statusCode).json({
            error: "Failed to fetch tags from Ollama API",
            details: errorMessage
        });
    }
});

// Proxy all other requests to Ollama API
app.use("*", async (req, res) => {
    try {
        // Remove unnecessary headers
        const headers = { ...req.headers };
        delete headers.host;
        delete headers.connection;

        // Get the actual path from the original URL
        const path = req.originalUrl;

        const response = await axios({
            method: req.method,
            url: `${OLLAMA_URL}${path}`,
            data: req.body,
            headers: headers,
            timeout: 600000, // 10 minute timeout for longer operations
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            responseType: 'stream'
        });

        // Log the response chunks
        let responseData = '';
        response.data.on('data', (chunk) => {
            responseData += chunk;
            console.log('Response chunk:', chunk.toString());
        });

        // Stream the response back to client
        response.data.pipe(res);
        
        // Log complete response when finished
        response.data.on('end', () => {
            console.log('Complete response:', responseData);
        });
        
    } catch (error) {
        console.error('Ollama API Error:', error.message);
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error || error.message;
        
        res.status(statusCode).json({
            error: "Failed to fetch from Ollama API",
            details: errorMessage,
            fullError: error,
            baseUrl: OLLAMA_URL,
            path: req.originalUrl
        });
    }
});

// Start the proxy server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Proxy server running on http://0.0.0.0:${PORT}`);
    console.log(`📡 Proxying requests to Ollama at: ${OLLAMA_URL}`);
});
