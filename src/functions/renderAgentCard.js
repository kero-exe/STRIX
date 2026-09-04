const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Edit this section to customize the complete card without changing the renderer below.
const ID_CARD_CONFIG = {
    width: 1200,
    height: 760,
    fontFamily: 'Borda',
    fontPath: path.join(__dirname, '../../resources/borda-webfont/Borda.woff'),
    colors: {
        background: '#10171b',
        panel: '#18252b',
        accent: '#d8a84e',
        text: '#f2f0e8',
        muted: '#9ba7a8',
        rule: '#42636a'
    },
    photo: { x: 70, y: 150, width: 330, height: 440, radius: 12 },
    surname: { x: 470, y: 190, fontSize: 58 },
    firstName: { x: 470, y: 255, fontSize: 38 },
    fields: { x: 470, y: 350, labelSize: 18, valueSize: 28, lineHeight: 72 },
    shdId: { x: 470, y: 690, fontSize: 40 },
    wave: { x: 1050, y: 690, fontSize: 26, anchor: 'end' },
    decoration: { x: 70, y: 82, width: 1060, opacity: 0.8 }
};

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function text(value, x, y, size, fill, anchor = 'start', weight = '400') {
    return `<text x="${x}" y="${y}" fill="${fill}" font-family="${ID_CARD_CONFIG.fontFamily}" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

async function loadAvatar(avatarUrl, width, height) {
    if (!avatarUrl) return null;
    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        return await sharp(buffer).resize(width, height, { fit: 'cover', position: 'centre' }).png().toBuffer();
    } catch {
        return null;
    }
}

function renderSvg(agent, fontData) {
    const config = ID_CARD_CONFIG;
    const fieldRows = [
        ['SEX', agent.sex],
        ['DATE OF BIRTH', agent.dateOfBirth],
        ['SPECIALTY', agent.occupationalSpecialty],
        ['ACTIVATED', agent.dateOfActivation]
    ];
    const fields = fieldRows.map(([label, value], index) => {
        const y = config.fields.y + index * config.fields.lineHeight;
        return `${text(label, config.fields.x, y, config.fields.labelSize, config.colors.muted)}${text(value, config.fields.x, y + 30, config.fields.valueSize, config.colors.text, 'start', '600')}`;
    }).join('');

    return `<svg width="${config.width}" height="${config.height}" xmlns="http://www.w3.org/2000/svg">
        <style>@font-face { font-family: '${config.fontFamily}'; src: url(data:font/woff;base64,${fontData}); }</style>
        <rect width="100%" height="100%" fill="${config.colors.background}"/>
        <rect x="28" y="28" width="${config.width - 56}" height="${config.height - 56}" rx="18" fill="${config.colors.panel}" stroke="${config.colors.rule}" stroke-width="3"/>
        <path d="M${config.decoration.x} ${config.decoration.y} H${config.decoration.x + config.decoration.width}" stroke="${config.colors.accent}" stroke-width="4" opacity="${config.decoration.opacity}"/>
        ${text('STRATEGIC HOMELAND DIVISION', config.decoration.x, 65, 24, config.colors.muted, 'start', '600')}
        ${text('AGENT IDENTIFICATION', config.decoration.x + config.decoration.width, 65, 24, config.colors.accent, 'end', '600')}
        <rect x="${config.photo.x}" y="${config.photo.y}" width="${config.photo.width}" height="${config.photo.height}" rx="${config.photo.radius}" fill="#0b1012" stroke="${config.colors.rule}" stroke-width="3"/>
        ${text(agent.surname || 'SURNAME', config.surname.x, config.surname.y, config.surname.fontSize, config.colors.text, 'start', '700')}
        ${text(agent.firstName || 'FIRST NAME', config.firstName.x, config.firstName.y, config.firstName.fontSize, config.colors.accent, 'start', '600')}
        ${fields}
        ${text(agent.shdId, config.shdId.x, config.shdId.y, config.shdId.fontSize, config.colors.accent, 'start', '700')}
        ${text((agent.deploymentWave || 'UNASSIGNED').toUpperCase(), config.wave.x, config.wave.y, config.wave.fontSize, config.colors.muted, config.wave.anchor, '600')}
    </svg>`;
}

async function renderAgentCard(agent) {
    if (!fs.existsSync(ID_CARD_CONFIG.fontPath)) {
        throw new Error(`Borda font missing. Add a licensed Borda.ttf file at ${ID_CARD_CONFIG.fontPath}.`);
    }

    const fontData = fs.readFileSync(ID_CARD_CONFIG.fontPath).toString('base64');
    const svg = Buffer.from(renderSvg(agent, fontData));
    const avatar = await loadAvatar(agent.avatarUrl, ID_CARD_CONFIG.photo.width, ID_CARD_CONFIG.photo.height);
    const image = sharp(svg);
    if (avatar) {
        return image.composite([{ input: avatar, left: ID_CARD_CONFIG.photo.x, top: ID_CARD_CONFIG.photo.y }]).png().toBuffer();
    }
    return image.png().toBuffer();
}

module.exports = { ID_CARD_CONFIG, renderAgentCard };
