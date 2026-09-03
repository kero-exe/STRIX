import { DiscordSDK } from 'https://cdn.jsdelivr.net/npm/@discord/embedded-app-sdk@2/+esm';

const status = document.querySelector('#status');
const agentCard = document.querySelector('#agent-card');
const agentName = document.querySelector('#agent-name');
const themeToggle = document.querySelector('#theme-toggle');
const layoutGroup = document.querySelector('#layout-panel-group');
const introOverlay = document.querySelector('#intro-overlay');
const introVideo = document.querySelector('#intro-video');
const shell = document.querySelector('.shell');
const quickLinks = document.querySelectorAll('.quick-link');
const mapButton = document.querySelector('#map-button');

function setStatus(message) {
    status.textContent = message;
}

function updateThemeButton(isDark) {
    document.body.classList.toggle('theme-dark', isDark);
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.textContent = isDark ? 'Light theme' : 'Dark theme';
}

function applyParallaxFromValues(x, y) {
    if (!layoutGroup) return;

    const dx = x * 12;
    const dy = y * 12;

    layoutGroup.style.transform = `translate(${dx * 0.55}px, ${dy * 0.55}px)`;
    layoutGroup.style.boxShadow = `0 18px 36px rgba(17, 17, 17, 0.2), ${dx * 1.4}px ${dy * 1.4}px 0 rgba(0, 0, 0, 0.08)`;
}

if (themeToggle) {
    const initialDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    updateThemeButton(initialDark);

    themeToggle.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('theme-dark');
        updateThemeButton(isDark);
    });
}

if (layoutGroup) {
    document.addEventListener('pointermove', (event) => {
        if (window.matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window) {
            return;
        }

        const { innerWidth, innerHeight } = window;
        const x = (event.clientX / innerWidth - 0.5) * 2;
        const y = (event.clientY / innerHeight - 0.5) * 2;

        document.body.style.backgroundPosition = `${50 + x * 6}% ${50 + y * 6}%`;
        applyParallaxFromValues(x, y);
    });

    document.addEventListener('pointerleave', () => {
        layoutGroup.style.transform = 'translate(0, 0)';
        layoutGroup.style.boxShadow = 'none';
        document.body.style.backgroundPosition = 'center';
    });
}

if (window.matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window) {
    window.addEventListener('deviceorientation', (event) => {
        const gamma = typeof event.gamma === 'number' ? event.gamma : 0;
        const beta = typeof event.beta === 'number' ? event.beta : 0;
        const x = Math.max(-1, Math.min(1, gamma / 30));
        const y = Math.max(-1, Math.min(1, beta / 45));

        document.body.style.backgroundPosition = `${50 + x * 8}% ${50 + y * 8}%`;
        applyParallaxFromValues(x, y);
    });
}

if (introOverlay && introVideo) {
    introVideo.play().catch(() => {});
    setTimeout(() => {
        document.body.classList.add('ready');
        introOverlay.classList.add('is-hidden');
        setTimeout(() => {
            introOverlay.style.display = 'none';
        }, 700);
    }, 2000);
}

if (mapButton) {
    mapButton.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = '/map.html';
    });
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
