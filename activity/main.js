import { DiscordSDK } from 'https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@2/+esm';

const status = document.querySelector('#status');
const agentCard = document.querySelector('#agent-card');
const agentName = document.querySelector('#agent-name');

function setStatus(message) {
    status.textContent = message;
}

async function start() {
    const config = await fetch('/api/config').then(response => response.json());
    if (!config.clientId) {
        setStatus('Set DISCORD_CLIENT_ID to connect this Activity.');
        return;
    }

    const discordSdk = new DiscordSDK(config.clientId);
    await discordSdk.ready();

    const { code } = await discordSdk.commands.authorize({
        client_id: config.clientId,
        response_type: 'code',
        state: crypto.randomUUID(),
        prompt: 'none',
        scope: ['identify']
    });
    const tokenResponse = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.error);

    await discordSdk.commands.authenticate({ access_token: token.access_token });
    const user = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token.access_token}` }
    }).then(response => response.json());

    agentName.textContent = user.global_name || user.username;
    agentCard.hidden = false;
    setStatus('Ready for deployment.');
}

start().catch(error => {
    console.error(error);
    setStatus('Open this page inside the Discord Activity to connect.');
});
