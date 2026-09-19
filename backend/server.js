import "dotenv/config"
import express from 'express'
import cors from 'cors'
import { randomUUID, timingSafeEqual } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
    LANGS, normalizeLang, detectLanguage, formatDate, randomPastDate, message,
    EPITAPHS, EULOGIES, CAUSES_OF_DEATH,
} from './lang.js'
import {
    ai, aiProvider, GEMINI_MODEL, generateEulogy, transcribe, synthesizeStream, narrationText,
} from './ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1'
// No default: a key printed in the README is not a secret. Unset = admin endpoints off.
const ADMIN_KEY = process.env.ADMIN_KEY || ''

const MAX_MISTAKE_LENGTH = 500
// 16 kHz mono 16-bit WAV is 32 KB a second; 30 seconds plus headroom.
const MAX_AUDIO_BYTES = 1.1 * 1024 * 1024

// Behind nginx every request comes from 127.0.0.1; trust it so req.ip is the visitor.
app.set('trust proxy', 'loopback')
app.use(cors({ origin: true, exposedHeaders: ['X-Session-Id'] }))
app.use(express.json({ limit: '10kb' }))

console.log(ai
    ? `✅ AI enabled — ${GEMINI_MODEL} via ${aiProvider}`
    : '⚠️  No VERTEX_AI_PROJECT or GEMINI_API_KEY — using static templates, voice off')

// ====================================================
// 💀 Abuse limits — every burial, transcription and narration is a paid AI call
// ====================================================

function limiter(perMinute, perDay) {
    const hits = new Map() // ip -> { minute, minuteCount, day, dayCount }
    setInterval(() => {
        const day = dayKey()
        for (const [ip, h] of hits) if (h.day !== day) hits.delete(ip)
    }, 60 * 60 * 1000).unref()
    return (ip) => {
        const minute = Math.floor(Date.now() / 60000)
        const day = dayKey()
        const h = hits.get(ip) || { minute, minuteCount: 0, day, dayCount: 0 }
        if (h.minute !== minute) { h.minute = minute; h.minuteCount = 0 }
        if (h.day !== day) { h.day = day; h.dayCount = 0 }
        if (h.minuteCount >= perMinute || h.dayCount >= perDay) return false
        h.minuteCount++
        h.dayCount++
        hits.set(ip, h)
        return true
    }
}

function dailyCap(limit) {
    let day = ''
    let used = 0
    return {
        take() {
            if (day !== dayKey()) { day = dayKey(); used = 0 }
            if (used >= limit) return false
            used++
            return true
        },
        get used() { return day === dayKey() ? used : 0 },
        limit,
    }
}

function dayKey() {
    return new Date().toISOString().slice(0, 10)
}

const env = (name, fallback) => Number(process.env[name] || fallback)
const buryQuota = limiter(env('BURY_PER_IP_PER_MINUTE', 6), env('BURY_PER_IP_PER_DAY', 60))
const sttQuota = limiter(env('STT_PER_IP_PER_MINUTE', 6), env('STT_PER_IP_PER_DAY', 40))
const ttsQuota = limiter(env('TTS_PER_IP_PER_MINUTE', 3), env('TTS_PER_IP_PER_DAY', 20))
const aiCap = dailyCap(env('AI_CALLS_PER_DAY', 2000))
const sttCap = dailyCap(env('STT_CALLS_PER_DAY', 1500))
const ttsCap = dailyCap(env('TTS_CALLS_PER_DAY', 300))

// ====================================================
// 💀 Data Storage — JSON file for persistence
// ====================================================

const DATA_DIR = path.join(__dirname, 'data')
const VOICE_DIR = path.join(DATA_DIR, 'voice')
const GRAVES_FILE = path.join(DATA_DIR, 'graves.json')
const LOG_FILE = path.join(DATA_DIR, 'burials.log')

fs.mkdirSync(VOICE_DIR, { recursive: true })

function loadGraves() {
    try {
        if (fs.existsSync(GRAVES_FILE)) {
            return JSON.parse(fs.readFileSync(GRAVES_FILE, 'utf-8'))
        }
    } catch (e) {
        console.error('Failed to load graves:', e.message)
    }
    return []
}

function saveGraves(graves) {
    // Write aside and rename, so a crash mid-write cannot leave half a JSON file.
    const tmp = `${GRAVES_FILE}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(graves, null, 2), 'utf-8')
    fs.renameSync(tmp, GRAVES_FILE)
}

function appendLog(entry) {
    const line = `[${new Date().toISOString()}] session=${entry.sessionId} | mistake="${entry.mistake}" | lang=${entry.lang} | deleted=${entry.is_deleted}\n`
    fs.appendFileSync(LOG_FILE, line, 'utf-8')
}

let allGraves = loadGraves()

const voicePath = (id) => path.join(VOICE_DIR, `${id}.mp3`)

// ====================================================
// 💀 Helpers
// ====================================================

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function truncateMistake(mistake, maxLen = 80) {
    if (mistake.length <= maxLen) return mistake
    return mistake.substring(0, maxLen).trim() + '...'
}

// The visitor's site language, for the messages we send back.
function uiLangOf(req) {
    return normalizeLang(req.body?.uiLang || req.query.lang || req.headers['x-lang']) || 'en'
}

function fail(res, status, code, lang, vars) {
    return res.status(status).json({ code, error: message(code, lang, vars) })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ====================================================
// 💀 Session Middleware
// ====================================================

const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

function sessionMiddleware(req, res, next) {
    // <audio src> cannot send headers, so the narration URL carries the session in ?s=
    let sessionId = req.headers['x-session-id'] || req.query.s
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
        sessionId = randomUUID()
    }
    req.sessionId = sessionId
    res.setHeader('X-Session-Id', sessionId)
    next()
}

app.use(sessionMiddleware)

function ownGrave(req) {
    return allGraves.find((g) => g.id === req.params.id && g.sessionId === req.sessionId && !g.is_deleted)
}

// ====================================================
// 💀 API Endpoints
// ====================================================

// POST /api/bury — Submit a mistake for burial
app.post('/api/bury', async (req, res) => {
    const { mistake } = req.body
    const sessionId = req.sessionId
    const uiLang = uiLangOf(req)

    if (!mistake || typeof mistake !== 'string' || mistake.trim().length < 2) {
        return fail(res, 400, 'tooShort', uiLang)
    }
    if (mistake.trim().length > MAX_MISTAKE_LENGTH) {
        return fail(res, 400, 'tooLong', uiLang, { max: MAX_MISTAKE_LENGTH })
    }
    if (!buryQuota(req.ip)) {
        return fail(res, 429, 'rateLimited', uiLang)
    }

    const started = Date.now()
    const cleanMistake = mistake.trim()
    const shortMistake = truncateMistake(cleanMistake, 80)
    const guess = detectLanguage(cleanMistake, uiLang)
    console.log(`💀 Burying mistake: "${truncateMistake(cleanMistake, 120)}" (sess: ${sessionId}, ui: ${uiLang}, guess: ${guess.lang}${guess.certain ? '' : '?'})`)

    // Try AI generation first, fall back to static templates
    let aiContent = null
    if (ai) {
        if (!aiCap.take()) {
            console.warn(`⚠️ Daily AI limit (${aiCap.limit}) reached — static templates until midnight UTC`)
        } else {
            try {
                aiContent = await generateEulogy(cleanMistake, guess.lang, guess.certain)
            } catch (e) {
                console.error('❌ AI generation error:', e.message)
            }
        }
    }

    const lang = aiContent?.lang || guess.lang
    const now = new Date()
    const graveData = {
        id: randomUUID(),
        sessionId,
        mistake: cleanMistake,
        born: formatDate(randomPastDate(), lang),
        died: formatDate(now, lang),
        epitaph: aiContent ? aiContent.epitaph : randomFrom(EPITAPHS[lang])(shortMistake),
        eulogy: aiContent ? aiContent.eulogy : randomFrom(EULOGIES[lang])(shortMistake),
        causeOfDeath: aiContent ? aiContent.causeOfDeath : randomFrom(CAUSES_OF_DEATH[lang]),
        lang,
        buriedAt: now.toISOString(),
        is_deleted: false,
        ai_generated: !!aiContent,
    }

    allGraves.push(graveData)
    saveGraves(allGraves)
    appendLog(graveData)

    // Let the digging ceremony play for at least a moment, without adding to a slow AI answer.
    const wait = Math.max(0, 2200 + Math.random() * 800 - (Date.now() - started))
    await sleep(wait)
    res.json({ ...graveData, voiceAvailable: !!ai })
})

// GET /api/graves — Get graves for current session (exclude soft-deleted)
app.get('/api/graves', (req, res) => {
    const sessionId = req.sessionId
    const userGraves = allGraves
        .filter(g => g.sessionId === sessionId && !g.is_deleted)
        .sort((a, b) => new Date(b.buriedAt) - new Date(a.buriedAt))
        .map((g) => ({ ...g, voiceAvailable: !!ai }))
    res.json(userGraves)
})

// DELETE /api/graves/:id — Soft delete (sets is_deleted = true)
app.delete('/api/graves/:id', (req, res) => {
    const uiLang = uiLangOf(req)
    const grave = ownGrave(req)

    if (!grave) {
        return fail(res, 404, 'notFound', uiLang)
    }

    // Soft delete — mark as deleted, do NOT remove from array
    grave.is_deleted = true
    grave.deleted_at = new Date().toISOString()
    saveGraves(allGraves)
    fs.rm(voicePath(grave.id), { force: true }, () => {})

    res.json({ success: true, message: message('deleted', uiLang) })
})

// GET /api/graves/:id/voice.mp3 — The narrator reads the eulogy.
// First listen: streamed live while Gemini speaks, and cached. Later listens: the file.
const liveNarrations = new Map() // grave id -> { chunks, listeners }

function startNarration(grave) {
    const job = { chunks: [], listeners: new Set() }
    liveNarrations.set(grave.id, job)
    const started = Date.now()
    ;(async () => {
        try {
            for await (const mp3 of synthesizeStream(narrationText(grave), grave.lang)) {
                job.chunks.push(mp3)
                for (const res of job.listeners) res.write(mp3)
            }
            const all = Buffer.concat(job.chunks)
            fs.writeFileSync(voicePath(grave.id), all)
            console.log(`🔊 Narration ${grave.id} (${grave.lang}): ${Math.round(all.length / 1024)} KB in ${Date.now() - started} ms`)
        } catch (e) {
            console.error('❌ TTS error:', e.message)
        } finally {
            liveNarrations.delete(grave.id)
            for (const res of job.listeners) res.end()
        }
    })()
    return job
}

app.get('/api/graves/:id/voice.mp3', (req, res) => {
    const uiLang = uiLangOf(req)
    const grave = ownGrave(req)
    if (!grave) return fail(res, 404, 'notFound', uiLang)
    if (fs.existsSync(voicePath(grave.id))) {
        res.setHeader('Cache-Control', 'private, max-age=86400')
        return res.type('audio/mpeg').sendFile(voicePath(grave.id))
    }
    if (!ai) return fail(res, 503, 'voiceOff', uiLang)

    // Safari probes a media URL with a second request; both share one generation.
    let job = liveNarrations.get(grave.id)
    if (!job) {
        if (!ttsQuota(req.ip)) return fail(res, 429, 'rateLimited', uiLang)
        if (!ttsCap.take()) return fail(res, 503, 'voiceBusy', uiLang)
        job = startNarration(grave)
    }

    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no', // nginx: pass each chunk straight through
    })
    for (const chunk of job.chunks) res.write(chunk)
    job.listeners.add(res)
    // Keep generating if the listener leaves: the audio is already paid for, and cached for next time.
    res.on('close', () => job.listeners.delete(res))
})

// POST /api/transcribe — A spoken confession (16 kHz mono WAV) → text
app.post('/api/transcribe',
    express.raw({ type: ['audio/wav', 'audio/x-wav', 'application/octet-stream'], limit: '1.5mb' }),
    async (req, res) => {
        const uiLang = uiLangOf(req)
        if (!ai) return fail(res, 503, 'voiceOff', uiLang)
        const wav = req.body
        if (!Buffer.isBuffer(wav) || wav.length < 44
            || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
            return fail(res, 400, 'badAudio', uiLang)
        }
        if (wav.length > MAX_AUDIO_BYTES) return fail(res, 413, 'audioTooLong', uiLang)
        if (!sttQuota(req.ip)) return fail(res, 429, 'rateLimited', uiLang)
        if (!sttCap.take()) return fail(res, 503, 'sttFailed', uiLang)

        try {
            const text = await transcribe(wav, uiLang)
            if (!text) return fail(res, 422, 'noSpeech', uiLang)
            res.json({ text: text.slice(0, MAX_MISTAKE_LENGTH) })
        } catch (e) {
            console.error('❌ STT error:', e.message)
            fail(res, 502, 'sttFailed', uiLang)
        }
    })

function isAdmin(req, res) {
    if (!ADMIN_KEY) {
        fail(res, 503, 'adminOff', uiLangOf(req))
        return false
    }
    const key = Buffer.from(String(req.headers['x-admin-key'] || req.query.key || ''))
    const expected = Buffer.from(ADMIN_KEY)
    if (key.length !== expected.length || !timingSafeEqual(key, expected)) {
        fail(res, 403, 'forbidden', uiLangOf(req))
        return false
    }
    return true
}

// GET /api/admin/graves — Admin view of ALL graves including soft-deleted
app.get('/api/admin/graves', (req, res) => {
    if (!isAdmin(req, res)) return

    const total = allGraves.length
    const deleted = allGraves.filter(g => g.is_deleted).length
    const active = total - deleted

    const stats = {
        total,
        active,
        soft_deleted: deleted,
        sessions: [...new Set(allGraves.map(g => g.sessionId))].length,
        ai_generated: allGraves.filter(g => g.ai_generated).length,
        languages: Object.fromEntries(LANGS.map((l) => [l, allGraves.filter(g => g.lang === l).length])),
        today: { ai: aiCap.used, stt: sttCap.used, tts: ttsCap.used },
    }

    res.json({
        stats,
        graves: [...allGraves].sort((a, b) => new Date(b.buriedAt) - new Date(a.buriedAt))
    })
})

// GET /api/admin/logs — Raw log file
app.get('/api/admin/logs', (req, res) => {
    if (!isAdmin(req, res)) return

    try {
        const logs = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : ''
        res.type('text/plain').send(logs || 'Лог пуст.')
    } catch (e) {
        res.status(500).json({ error: 'Ошибка чтения лога.' })
    }
})

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'Склеп открыт. The crypt is open.',
        totalBurials: allGraves.length,
        activeBurials: allGraves.filter(g => !g.is_deleted).length,
        softDeleted: allGraves.filter(g => g.is_deleted).length,
        aiEnabled: !!ai,
        aiProvider,
        aiModel: ai ? GEMINI_MODEL : null,
        voice: !!ai,
        languages: LANGS,
        timestamp: new Date().toISOString(),
    })
})

// A body over the size limit (e.g. a long recording) → a JSON answer, not an HTML page.
app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') return fail(res, 413, 'audioTooLong', uiLangOf(req))
    if (err?.type === 'entity.parse.failed') return fail(res, 400, 'tooShort', uiLangOf(req))
    console.error('❌ Unhandled error:', err?.message)
    res.status(500).json({ error: 'Internal error' })
})

app.listen(PORT, HOST, () => {
    console.log(`\n💀 Склеп открыт на ${HOST}:${PORT}`)
    console.log(`   POST   /api/bury                — Похоронить ошибку`)
    console.log(`   GET    /api/graves              — Мои могилы`)
    console.log(`   DELETE /api/graves/:id          — Мягко удалить могилу`)
    console.log(`   GET    /api/graves/:id/voice.mp3 — Панихида голосом`)
    console.log(`   POST   /api/transcribe          — Голос → текст`)
    console.log(`   GET    /api/admin/graves        — [ADMIN] Все могилы (включая удалённые)`)
    console.log(`   GET    /api/admin/logs          — [ADMIN] Лог файл`)
    console.log(`   GET    /api/health              — Статус`)
    console.log(`\n   Admin: ${ADMIN_KEY ? 'enabled (ADMIN_KEY set)' : 'disabled (no ADMIN_KEY)'}`)
    console.log(`   AI: ${ai ? `✅ ${GEMINI_MODEL} via ${aiProvider}` : '⚠️  disabled — static templates'}\n`)
})
