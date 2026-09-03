const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { URLSearchParams } = require('url');

require('dotenv').config();

const activityRoot = path.join(__dirname, '..', '..', 'activity');
const projectRoot = path.join(__dirname, '..', '..');
let activityServerInstance = null;

function createActivityServer() {
    const app = express();

    app.use(express.json());
    app.get('/api/config', (request, response) => {
        response.json({
            clientId: process.env.DISCORD_CLIENT_ID || null,
            activityLaunchUrl: process.env.DISCORD_ACTIVITY_LAUNCH_URL || null
        });
    });

    app.post('/api/token', async (request, response) => {
        const { code } = request.body || {};
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;

        if (!code || !clientId || !clientSecret) {
            response.status(400).json({ error: 'Discord OAuth configuration is incomplete.' });
            return;
        }

        try {
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: 'authorization_code',
                    code
                })
            });
            const token = await tokenResponse.json();

            if (!tokenResponse.ok) {
                response.status(tokenResponse.status).json({ error: token.error_description || 'Discord authorization failed.' });
                return;
            }

            response.json({ access_token: token.access_token });
        } catch (error) {
            console.error('Discord token exchange failed:', error);
            response.status(502).json({ error: 'Could not reach Discord authorization.' });
        }
    });

    app.get('/health', (request, response) => response.json({ ok: true }));
    app.get('/api/districts', (request, response) => {
        try {
            const districts = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src', 'data', 'districts.geojson'), 'utf8'));
            response.json(districts);
        } catch (error) {
            console.error('Failed to read district GeoJSON:', error);
            response.status(500).json({ error: 'District data is unavailable.' });
        }
    });
    app.use(express.static(activityRoot));
    app.get('*splat', (request, response) => response.sendFile(path.join(activityRoot, 'index.html')));

    return app;
}

function startActivityServer() {
    if (activityServerInstance && activityServerInstance.listening) {
        return activityServerInstance;
    }

    const port = Number(process.env.ACTIVITY_PORT || 3000);
    const host = process.env.ACTIVITY_HOST || 'localhost';
    const certPath = path.resolve(projectRoot, process.env.ACTIVITY_TLS_CERT_PATH || 'localhost+1.pem');
    const keyPath = path.resolve(projectRoot, process.env.ACTIVITY_TLS_KEY_PATH || 'localhost+1-key.pem');
    const certificateFilesPresent = fs.existsSync(certPath) && fs.existsSync(keyPath);
    const useHttps = process.env.ACTIVITY_USE_HTTPS !== 'false' && certificateFilesPresent;

    if (process.env.ACTIVITY_USE_HTTPS === 'true' && !certificateFilesPresent) {
        throw new Error(`HTTPS was requested, but the certificate files were not found at ${certPath} and ${keyPath}.`);
    }

    const app = createActivityServer();
    const server = useHttps
        ? https.createServer({
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        }, app)
        : app;

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.warn(`Port ${port} is already in use; reusing the active STRIX activity server if present.`);
            return;
        }

        throw error;
    });

    server.listen(port, host, () => {
        activityServerInstance = server;
        const protocol = useHttps ? 'https' : 'http';
        console.log(`Activity server listening on ${protocol}://${host}:${port}`);
    });

    activityServerInstance = server;
    return server;
}

module.exports = { createActivityServer, startActivityServer };

if (require.main === module) {
    startActivityServer();
}
