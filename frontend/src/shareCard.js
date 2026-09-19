// ====================================================
// 📤 Share — the gravestone as an image for Telegram / Instagram
// ====================================================

const W = 1080
const H = 1350

export const FONTS = {
    display: (lang) => lang === 'en' ? '"UnifrakturMaguntia", serif'
        : lang === 'fa' ? '"Aref Ruqaa", "Amiri", serif'
            : '"Oranienbaum", "EB Garamond", serif',
    serif: (lang) => lang === 'fa' ? '"Amiri", "Vazirmatn", serif' : '"EB Garamond", Georgia, serif',
    sans: (lang) => lang === 'fa' ? '"Vazirmatn", sans-serif' : '"Inter", system-ui, sans-serif',
}

/** Draws the card and hands it to the phone's share sheet, or downloads it. */
export async function shareGrave(grave, t, uiLang) {
    const blob = await renderCard(grave, t, uiLang)
    const file = new File([blob], 'funeral-for-stupid-decisions.png', { type: 'image/png' })
    const url = `${location.origin}/?lang=${uiLang}`
    const data = { files: [file], text: `${t('shareText')} ${url}` }
    if (navigator.canShare?.(data)) {
        try {
            await navigator.share(data)
            return 'shared'
        } catch (e) {
            if (e.name === 'AbortError') return 'cancelled'
        }
    }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 10000)
    return 'saved'
}

async function renderCard(grave, t, uiLang) {
    const lang = grave.lang || uiLang
    const rtl = lang === 'fa'
    const labelRtl = uiLang === 'fa'

    // Webfonts load per script on demand; ask for exactly the glyphs we are about to draw.
    const sample = `${grave.mistake} ${grave.epitaph} ${grave.causeOfDeath}`
    await Promise.all([
        document.fonts.load(`64px ${FONTS.display(uiLang)}`, t('rip')),
        document.fonts.load(`italic 40px ${FONTS.serif(lang)}`, sample),
        document.fonts.load(`40px ${FONTS.serif(lang)}`, sample),
        document.fonts.load(`600 28px ${FONTS.sans(uiLang)}`, t('causeLabel')),
        document.fonts.load(`28px ${FONTS.sans(lang)}`, sample),
    ]).catch(() => {})

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')

    // Night sky
    const sky = ctx.createRadialGradient(W / 2, 0, 50, W / 2, 200, H)
    sky.addColorStop(0, '#2a1846')
    sky.addColorStop(0.45, '#120d1f')
    sky.addColorStop(1, '#050507')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    // Title
    ctx.textAlign = 'center'
    ctx.direction = labelRtl ? 'rtl' : 'ltr'
    ctx.fillStyle = 'rgba(232, 232, 240, 0.75)'
    ctx.font = `44px ${FONTS.display(uiLang)}`
    ctx.fillText(`💀 ${t('title')}`, W / 2, 110)

    // Tombstone
    const x = 130
    const y = 190
    const w = W - 260
    const h = 900
    const r = w / 2
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, y + r * 0.55)
    ctx.ellipse(x + r, y + r * 0.55, r, r * 0.55, 0, Math.PI, 0)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.closePath()
    const stone = ctx.createLinearGradient(0, y, 0, y + h)
    stone.addColorStop(0, '#3a3a4c')
    stone.addColorStop(0.45, '#23232f')
    stone.addColorStop(1, '#15151d')
    ctx.fillStyle = stone
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 60
    ctx.shadowOffsetY = 25
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.stroke()
    ctx.restore()

    // Ground
    ctx.fillStyle = '#0b0b0e'
    ctx.beginPath()
    ctx.ellipse(W / 2, y + h + 10, w * 0.62, 55, 0, 0, Math.PI * 2)
    ctx.fill()

    // Lay the text out first, then centre the whole block on the stone.
    const cx = W / 2
    const maxW = w - 140
    const quotes = lang === 'en' ? ['“', '”'] : ['«', '»']
    const blocks = [
        { text: t('rip'), font: `${uiLang === 'en' ? 80 : 68}px ${FONTS.display(uiLang)}`, color: '#e8e8f0', rtl: labelRtl, lh: 86, max: 1, gap: 0 },
        { text: grave.mistake, font: `${rtl ? '' : 'italic '}40px ${FONTS.serif(lang)}`, color: '#ffb526', rtl, lh: rtl ? 60 : 52, max: 3, gap: 28 },
        { text: `${grave.born} — ${grave.died}`, font: `28px ${FONTS.sans(lang)}`, color: 'rgba(160,160,190,0.9)', rtl, lh: 40, max: 1, gap: 14 },
        { divider: true, gap: 26 },
        { text: `${quotes[0]}${grave.epitaph}${quotes[1]}`, font: `${rtl ? '' : 'italic '}42px ${FONTS.serif(lang)}`, color: '#d8d8e6', rtl, lh: rtl ? 64 : 58, max: 5, gap: 26 },
        { text: `⚕️ ${t('causeLabel')}`, font: `600 26px ${FONTS.sans(uiLang)}`, color: '#8f7a9a', rtl: labelRtl, lh: 36, max: 1, gap: 34 },
        { text: grave.causeOfDeath, font: `30px ${FONTS.sans(lang)}`, color: '#c97a98', rtl, lh: 42, max: 2, gap: 4 },
    ]
    let total = 0
    for (const b of blocks) {
        if (b.divider) { total += b.gap + 2; continue }
        ctx.font = b.font
        ctx.direction = b.rtl ? 'rtl' : 'ltr'
        b.lines = wrapLines(ctx, b.text, maxW, b.max)
        total += b.gap + b.lines.length * b.lh
    }
    const areaTop = y + r * 0.3
    const areaBottom = y + h - 40
    let cy = areaTop + Math.max(0, (areaBottom - areaTop - total) / 2)
    for (const b of blocks) {
        cy += b.gap
        if (b.divider) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(cx - 180, cy)
            ctx.lineTo(cx + 180, cy)
            ctx.stroke()
            cy += 2
            continue
        }
        ctx.font = b.font
        ctx.fillStyle = b.color
        ctx.direction = b.rtl ? 'rtl' : 'ltr'
        ctx.textBaseline = 'top'
        b.lines.forEach((line, i) => ctx.fillText(line, cx, cy + i * b.lh + (b.lh - parseInt(/(\d+)px/.exec(b.font)[1], 10)) / 2))
        cy += b.lines.length * b.lh
    }
    ctx.textBaseline = 'alphabetic'

    // Candles + address
    ctx.font = '50px serif'
    ctx.direction = 'ltr'
    ctx.fillText('🕯️      🕯️      🕯️', cx, y + h + 95)
    ctx.fillStyle = 'rgba(200,200,216,0.55)'
    ctx.font = `26px ${FONTS.sans('en')}`
    ctx.fillText(location.host, cx, H - 30)

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// Word-wraps text to maxWidth; extra lines fold into "…".
function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/)
    const lines = []
    let line = ''
    for (const word of words) {
        const next = line ? `${line} ${word}` : word
        if (ctx.measureText(next).width > maxWidth && line) {
            lines.push(line)
            line = word
        } else {
            line = next
        }
    }
    if (line) lines.push(line)
    if (lines.length > maxLines) {
        lines.length = maxLines
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s.,;:!?،]+$/, '')}…`
    }
    return lines
}
