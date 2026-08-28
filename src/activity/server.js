const express = require('express');
const path = require('path');
const { URLSearchParams } = require('url');

require('dotenv').config();

const activityRoot = path.join(__dirname, '..', '..', 'activity');

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
    app.use(express.static(activityRoot));
    app.get('*splat', (request, response) => response.sendFile(path.join(activityRoot, 'index.html')));

    return app;
}

function startActivityServer() {
    const port = Number(process.env.ACTIVITY_PORT || 3000);
    const host = process.env.ACTIVITY_HOST || '0.0.0.0';
    const server = createActivityServer().listen(port, host, () => {
        console.log(`Activity server listening on http://localhost:${port}`);
    });
    return server;
}

module.exports = { createActivityServer, startActivityServer };
