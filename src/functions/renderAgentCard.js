const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

// Designer controls: edit this section to change the card without changing rendering logic.
const ID_CARD_CONFIG = {
    width: 1200,
    height: 760,
    fontFamily: 'Borda',
    fontPath: path.join(__dirname, '../../resources/borda-webfont/Borda.ttf'),
    logoPath: path.join(__dirname, '../../resources/images/SHD.webp'),
    theme: 'dark',
    themes: {
        dark: { background: '#1e2020', panel: '#202323', accent: '#ff6d10', gold: '#cfad6a', text: '#f7f7f7', photoBackground: '#151515' },
        light: { background: '#f7f7f7', panel: '#ffffff', accent: '#ff6d10', gold: '#9a7735', text: '#1f1f1f', photoBackground: '#ffffff' }
    },
    frame: { x: 10, y: 10, widthInset: 20, heightInset: 20, radius: 18, strokeWidth: 4 },
    header: { x: 12, y: 12, widthInset: 24, height: 144, logoX: 78, logoY: 84, logoSize: 58, textX: 148, firstLineY: 68, secondLineY: 108, textSize: 33 },
    panel: { top: 156 },
    identity: { x: 72, surnameY: 226, firstNameY: 270, maxWidth: 700, surnameSize: 53, firstNameSize: 36, gap: 10 },
    personnel: { x: 72, top: 323, columnGap: 44, columnWidth: 335, rowGap: 58, labelSize: 15, valueSize: 24, valueMaxWidth: 320 },
    photo: { x: 826, y: 35, width: 302, height: 350, radius: 16, strokeWidth: 4, inset: 10 },
    identification: { x: 826, top: 492, width: 302, height: 172, labelY: 516, barcodeY: 530, idY: 631, waveY: 657, labelSize: 13, idSize: 27, waveSize: 15, barcode: { width: 270, height: 58, barWidth: 2 } },
    qr: { x: 72, y: 525, size: 104, labelSize: 12 },
    backdrop: { hexSize: 22, strokeWidth: 1, opacity: 0.1 },
    shading: { headerOpacity: 0.18, panelOpacity: 0.12, photoOpacity: 0.28 },
    footer: { y: 731, fontSize: 12, x: 72 }
};

function svgBackground(colors) {
    const c = ID_CARD_CONFIG;
    const size = c.backdrop.hexSize;
    const hexHeight = Math.round(size * 0.866);
    return `<svg width="${c.width}" height="${c.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id="hex" width="${size * 1.5}" height="${hexHeight * 2}" patternUnits="userSpaceOnUse"><path d="M${size / 2} 0 L${size} ${hexHeight / 2} L${size} ${hexHeight * 1.5} L${size / 2} ${hexHeight * 2} L0 ${hexHeight * 1.5} L0 ${hexHeight / 2} Z" fill="none" stroke="${colors.text}" stroke-width="${c.backdrop.strokeWidth}" opacity="${c.backdrop.opacity}"/></pattern>
            <linearGradient id="headerShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${c.shading.headerOpacity}"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient>
            <linearGradient id="panelShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${c.shading.panelOpacity}"/><stop offset="1" stop-color="#000000" stop-opacity="0.16"/></linearGradient>
            <linearGradient id="photoShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/><stop offset="0.55" stop-color="#000000" stop-opacity="${c.shading.photoOpacity}"/><stop offset="1" stop-color="#000000" stop-opacity="0.5"/></linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="${colors.background}"/>
        <rect x="${c.frame.x}" y="${c.frame.y}" width="${c.width - c.frame.widthInset}" height="${c.height - c.frame.heightInset}" rx="${c.frame.radius}" fill="${colors.background}" stroke="${colors.accent}" stroke-width="${c.frame.strokeWidth}"/>
        <path d="M${c.header.x} ${c.header.y} H${c.width - c.header.x} V${c.header.y + c.header.height} H${c.header.x} Z" fill="${colors.accent}"/>
        <path d="M${c.header.x} ${c.header.y} H${c.width - c.header.x} V${c.header.y + c.header.height} H${c.header.x} Z" fill="url(#headerShade)"/>
        <path d="M${c.frame.x} ${c.panel.top} H${c.width - c.frame.x} V${c.height - c.frame.y} H${c.frame.x} Z" fill="${colors.panel}"/>
        <path d="M${c.frame.x} ${c.panel.top} H${c.width - c.frame.x} V${c.height - c.frame.y} H${c.frame.x} Z" fill="url(#hex)"/>
        <path d="M${c.frame.x} ${c.panel.top} H${c.width - c.frame.x} V${c.height - c.frame.y} H${c.frame.x} Z" fill="url(#panelShade)"/>
        <rect x="${c.photo.x}" y="${c.photo.y}" width="${c.photo.width}" height="${c.photo.height}" rx="${c.photo.radius}" fill="${colors.photoBackground}" stroke="${colors.accent}" stroke-width="${c.photo.strokeWidth}"/>
        <rect x="${c.photo.x}" y="${c.photo.y}" width="${c.photo.width}" height="${c.photo.height}" rx="${c.photo.radius}" fill="url(#photoShade)"/>
        <path d="M${c.photo.x + c.photo.inset} ${c.photo.y + c.photo.inset}h42 M${c.photo.x + c.photo.inset} ${c.photo.y + c.photo.inset}v42 M${c.photo.x + c.photo.width - c.photo.inset} ${c.photo.y + c.photo.height - c.photo.inset}h-42 M${c.photo.x + c.photo.width - c.photo.inset} ${c.photo.y + c.photo.height - c.photo.inset}v-42" fill="none" stroke="${colors.accent}" stroke-width="2" opacity="0.55"/>
        <rect x="${c.identification.x}" y="${c.identification.top}" width="${c.identification.width}" height="${c.identification.height}" rx="10" fill="${colors.background}" stroke="${colors.accent}" stroke-width="1" opacity="0.92"/>
        <path d="M${c.identification.x + 18} ${c.identification.top + 31}H${c.identification.x + c.identification.width - 18}" stroke="${colors.gold}" stroke-width="1" opacity="0.45"/>
    </svg>`;
}

function drawText(ctx, value, x, y, size, color, weight = 600, align = 'left') {
    ctx.font = `${weight} ${size}px ${ID_CARD_CONFIG.fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(value || ''), x, y);
}

function drawFittedText(ctx, value, x, y, size, color, maxWidth, weight = 600, align = 'left') {
    const text = String(value || 'NOT PROVIDED').toUpperCase();
    let fittedSize = size;
    while (fittedSize > 12) {
        ctx.font = `${weight} ${fittedSize}px ${ID_CARD_CONFIG.fontFamily}`;
        if (ctx.measureText(text).width <= maxWidth) break;
        fittedSize -= 1;
    }
    let output = text;
    if (ctx.measureText(output).width > maxWidth) {
        while (output.length > 3 && ctx.measureText(`${output}...`).width > maxWidth) output = output.slice(0, -1);
        output = `${output.trimEnd()}...`;
    }
    drawText(ctx, output, x, y, fittedSize, color, weight, align);
}

function textLayer(agent, colors) {
    const c = ID_CARD_CONFIG;
    const p = c.personnel;
    const i = c.identification;
    const canvas = createCanvas(c.width, c.height);
    const ctx = canvas.getContext('2d');
    if (!GlobalFonts.has(c.fontFamily) && !GlobalFonts.registerFromPath(c.fontPath, c.fontFamily)) throw new Error(`Could not register Borda font at ${c.fontPath}.`);
    drawText(ctx, 'STRATEGIC', c.header.textX, c.header.firstLineY, c.header.textSize, colors.text, 700);
    drawText(ctx, 'HOMELAND DIVISION', c.header.textX, c.header.secondLineY, c.header.textSize, colors.text, 700);
    drawFittedText(ctx, agent.surname || 'SURNAME', c.identity.x, c.identity.surnameY, c.identity.surnameSize, colors.text, c.identity.maxWidth, 700);
    drawFittedText(ctx, agent.firstName || 'FIRST NAME', c.identity.x, c.identity.firstNameY, c.identity.firstNameSize, colors.accent, c.identity.maxWidth, 600);
    const pair = (label, value, x, y, maxWidth = p.valueMaxWidth) => {
        const labelText = `${label}: `;
        drawText(ctx, labelText, x, y, p.labelSize, colors.gold, 600);
        const valueX = x + ctx.measureText(labelText).width;
        drawFittedText(ctx, value || 'NOT PROVIDED', valueX, y, p.valueSize, colors.text, maxWidth, 600);
    };
    const rightX = p.x + p.columnWidth + p.columnGap;
    pair('SEX', agent.sex, p.x, p.top);
    pair('SPECIALTY', agent.occupationalSpecialty, rightX, p.top, p.valueMaxWidth - 20);
    pair('DOB', agent.dateOfBirth, p.x, p.top + p.rowGap);
    pair('ACTIVATED', agent.dateOfActivation, rightX, p.top + p.rowGap);
    pair('DEPLOYMENT', agent.deploymentWave, p.x, p.top + p.rowGap * 2);
    drawText(ctx, 'IDENTIFICATION', i.x + 18, i.labelY, i.labelSize, colors.gold, 600);
    drawFittedText(ctx, agent.shdId || 'SHD UNASSIGNED', i.x + 18, i.idY, i.idSize, colors.text, i.width - 36, 700);
    drawFittedText(ctx, String(agent.deploymentWave || 'UNASSIGNED'), i.x + i.width - 18, i.waveY, i.waveSize, colors.gold, i.width - 36, 600, 'right');
    drawText(ctx, 'QR EMPTY', c.qr.x + c.qr.size / 2, c.qr.y + c.qr.size + 23, c.qr.labelSize, colors.gold, 600, 'center');
    drawText(ctx, 'ISSUED BY STRIX // REPORT LOST CREDENTIALS TO SHD NETWORK', c.footer.x, c.footer.y, c.footer.fontSize, colors.gold, 600);
    return canvas.toBuffer('image/png');
}

function qrPlaceholder(colors) {
    const q = ID_CARD_CONFIG.qr;
    return `<g stroke="${colors.accent}" fill="none" stroke-width="3"><rect x="${q.x}" y="${q.y}" width="${q.size}" height="${q.size}"/><path d="M${q.x + 13} ${q.y + 13}h35v35h-35z M${q.x + q.size - 48} ${q.y + 13}h35v35h-35z M${q.x + 13} ${q.y + q.size - 48}h35v35h-35z"/><path d="M${q.x + 65} ${q.y + 65}h14v14h-14z M${q.x + 92} ${q.y + 73}h16v16h-16z" fill="${colors.accent}" stroke="none"/></g>`;
}

function barcode(colors, value) {
    const c = ID_CARD_CONFIG.identification;
    const b = c.barcode;
    const bits = Array.from(String(value || 'SHD')).flatMap(character => [...character.charCodeAt(0).toString(2).padStart(8, '0'), '0']);
    const scale = b.width / bits.length;
    return `<g>${bits.map((bit, index) => bit === '1' ? `<rect x="${c.x + 16 + index * scale}" y="${c.barcodeY}" width="${Math.max(b.barWidth, scale * 0.8)}" height="${b.height}" fill="${colors.text}"/>` : '').join('')}</g>`;
}

async function loadAvatar(avatarUrl, width, height) {
    if (!avatarUrl) return null;
    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) return null;
        return sharp(Buffer.from(await response.arrayBuffer())).resize(width, height, { fit: 'cover', position: 'centre' }).png().toBuffer();
    } catch { return null; }
}

async function renderAgentCard(agent, options = {}) {
    if (!fs.existsSync(ID_CARD_CONFIG.fontPath)) throw new Error(`Borda font missing at ${ID_CARD_CONFIG.fontPath}.`);
    if (!fs.existsSync(ID_CARD_CONFIG.logoPath)) throw new Error(`SHD logo missing at ${ID_CARD_CONFIG.logoPath}.`);
    const colors = ID_CARD_CONFIG.themes[options.theme || ID_CARD_CONFIG.theme] || ID_CARD_CONFIG.themes.dark;
    const background = Buffer.from(svgBackground(colors).replace('</svg>', `${qrPlaceholder(colors)}${barcode(colors, agent.shdId)}</svg>`));
    const logoRaster = await sharp(ID_CARD_CONFIG.logoPath)
        .resize(ID_CARD_CONFIG.header.logoSize * 2, ID_CARD_CONFIG.header.logoSize * 2, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    for (let index = 0; index < logoRaster.data.length; index += 4) {
        logoRaster.data[index] = 255;
        logoRaster.data[index + 1] = 255;
        logoRaster.data[index + 2] = 255;
    }
    const logo = await sharp(logoRaster.data, { raw: logoRaster.info }).png().toBuffer();
    const composites = [
        { input: logo, left: ID_CARD_CONFIG.header.logoX - ID_CARD_CONFIG.header.logoSize, top: ID_CARD_CONFIG.header.logoY - ID_CARD_CONFIG.header.logoSize },
        { input: textLayer(agent, colors), left: 0, top: 0 }
    ];
    const photo = ID_CARD_CONFIG.photo;
    const avatar = await loadAvatar(agent.avatarUrl, photo.width - photo.inset * 2, photo.height - photo.inset * 2);
    if (avatar) {
        const mask = Buffer.from(`<svg width="${photo.width - photo.inset * 2}" height="${photo.height - photo.inset * 2}"><rect width="100%" height="100%" rx="${Math.max(4, photo.radius - photo.inset)}" fill="white"/></svg>`);
        composites.push({ input: await sharp(avatar).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), left: photo.x + photo.inset, top: photo.y + photo.inset });
    }
    return sharp(background).composite(composites).png().toBuffer();
}

module.exports = { ID_CARD_CONFIG, renderAgentCard };
