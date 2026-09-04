const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');

const app = express();
const port = Number(process.env.AGENT_CARD_PREVIEW_PORT || 4173);
const host = process.env.AGENT_CARD_PREVIEW_HOST || 'localhost';
const rendererPath = path.resolve(__dirname, '../src/functions/renderAgentCard.js');
const previewPath = path.resolve(__dirname, '../activity/agent-card-preview.html');
const sampleAgent = {
    surname: 'Anderson',
    firstName: 'James',
    sex: 'M',
    dateOfBirth: '17 APR 1988',
    occupationalSpecialty: 'PARAMEDIC',
    dateOfActivation: '12 DEC 2016',
    deploymentWave: 'SECOND WAVE',
    shdId: 'SHD-02-5839147'
};
let version = 0;
const clients = new Set();

function loadRenderer() {
    delete require.cache[require.resolve(rendererPath)];
    return require(rendererPath);
}

async function renderPreview(theme) {
    const { renderAgentCard } = loadRenderer();
    return renderAgentCard(sampleAgent, { theme });
}

app.get('/', (request, response) => response.sendFile(previewPath));
app.get('/api/card', async (request, response) => {
    try {
        response.type('png').send(await renderPreview(request.query.theme));
    } catch (error) {
        response.status(500).json({ error: error.message });
    }
});
app.get('/api/events', (request, response) => {
    response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
    });
    response.write(`data: ${JSON.stringify({ version })}\n\n`);
    clients.add(response);
    request.on('close', () => clients.delete(response));
});

const rendererWatcher = fs.watch(rendererPath, { persistent: true }, (eventType) => {
    if (eventType !== 'change') return;
    version += 1;
    for (const client of clients) client.write(`data: ${JSON.stringify({ version })}\n\n`);
});

const server = http.createServer(app);

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Agent card preview could not start because ${host}:${port} is already in use.`);
        console.error(`The existing preview may already be available at http://${host}:${port}.`);
        console.error(`To use another port, run: $env:AGENT_CARD_PREVIEW_PORT=4174; npm run preview-agent-card`);
        rendererWatcher.close();
        process.exit(1);
    }

    console.error('Agent card preview server failed:', error);
    rendererWatcher.close();
    process.exit(1);
});

server.listen(port, host, () => {
    console.log(`Agent card preview listening on http://${host}:${port}`);
});
