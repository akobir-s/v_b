import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    I18nContext, useI18n, translator, initialLang, LANGS, langMeta, guessAnswerLang, OFFLINE_TEMPLATES,
} from './i18n'
import { startRecording, micSupported } from './recorder'
import { shareGrave } from './shareCard'

// ====================================================
// 💀 Session Management
// ====================================================

function getSessionId() {
    let id = null
    try { id = localStorage.getItem('funeral-session-id') } catch { /* private mode */ }
    if (!id) {
        id = (self.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`)
        try { localStorage.setItem('funeral-session-id', id) } catch { /* private mode */ }
    }
    return id
}

const SESSION_ID = getSessionId()

// Same origin by default: nginx (and the Vite dev proxy) route /api to the backend.
// Set VITE_API_URL only when the API lives on another host.
const API_URL = import.meta.env.VITE_API_URL || ''

// The site language, sent with every request so server messages come back in it.
let currentLang = 'en'

const MAX_MISTAKE_LENGTH = 500

// --- FRONTEND-ONLY FALLBACK (backend unreachable) ---

function localBury(mistake) {
    const lang = guessAnswerLang(mistake, currentLang)
    const tpl = OFFLINE_TEMPLATES[lang] || OFFLINE_TEMPLATES.en
    const now = new Date()
    const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)]
    const short = mistake.length > 80 ? `${mistake.slice(0, 80).trim()}...` : mistake
    const grave = {
        id: 'local-' + Math.random().toString(36).slice(2, 11),
        mistake,
        born: String(now.getFullYear() - 1 - Math.floor(Math.random() * 5)),
        died: String(now.getFullYear()),
        epitaph: randomFrom(tpl.epitaphs)(short),
        eulogy: randomFrom(tpl.eulogies)(short),
        causeOfDeath: randomFrom(tpl.causes),
        lang,
        buriedAt: now.toISOString(),
        isLocal: true,
    }
    try {
        const existing = JSON.parse(localStorage.getItem('funeral-local-graves') || '[]')
        localStorage.setItem('funeral-local-graves', JSON.stringify([grave, ...existing]))
    } catch { /* private mode */ }
    return grave
}

function getLocalGraves() {
    try { return JSON.parse(localStorage.getItem('funeral-local-graves') || '[]') } catch { return [] }
}

function deleteLocalGrave(id) {
    const existing = getLocalGraves()
    try { localStorage.setItem('funeral-local-graves', JSON.stringify(existing.filter(g => g.id !== id))) } catch { /* private mode */ }
}

async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Session-Id': SESSION_ID,
        'X-Lang': currentLang,
        ...options.headers,
    }
    let res
    try {
        res = await fetch(`${API_URL}${path}`, { ...options, headers })
    } catch (e) {
        // Only a network failure means the backend is unreachable. An HTTP error below
        // (400, 429, 500) is a real answer and must reach the user, not a fake grave.
        console.warn(`Backend unreachable at ${API_URL || location.origin}, using frontend fallback for ${path}`)
        // Handle specific endpoints for frontend-only mode
        if (path === '/api/graves' && options.method !== 'DELETE') {
            return getLocalGraves()
        }
        if (path === '/api/bury' && options.method === 'POST') {
            const { mistake } = JSON.parse(options.body)
            // Simulate server delay for bury
            await new Promise(r => setTimeout(r, 1500))
            return localBury(mistake)
        }
        if (path.startsWith('/api/graves/') && options.method === 'DELETE') {
            const id = path.split('/').pop()
            if (id.startsWith('local-')) {
                deleteLocalGrave(id)
                return { success: true }
            }
        }
        throw e // Rethrow if we can't mock it
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || translator(currentLang)('genericError'))
    }
    return res.json()
}

// ====================================================
// 🔊 One audio context for the whole page
// ====================================================
//
// iOS allows only a handful of AudioContexts per page; the old code made a new one
// for every burial thud and went silent after a few burials.

let sharedCtx = null

function audioCtx() {
    if (!sharedCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        sharedCtx = new Ctx()
    }
    if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {})
    return sharedCtx
}

// The ambience's master volume: muted by the user, ducked while the narrator speaks.
const ambient = { gain: null, muted: false, ducked: false }

function applyAmbientVolume() {
    if (!ambient.gain || !sharedCtx) return
    const target = ambient.muted ? 0.0001 : ambient.ducked ? 0.06 : 0.4
    const now = sharedCtx.currentTime
    ambient.gain.gain.cancelScheduledValues(now)
    ambient.gain.gain.setTargetAtTime(target, now, 0.25)
}

function duckAmbient(on) {
    ambient.ducked = on
    applyAmbientVolume()
}
// ====================================================
// 💀 Particles Component
// ====================================================

function Particles() {
    const particles = useRef(
        Array.from({ length: 12 }).map((_, i) => ({
            left: `${5 + (i * 8.3) % 90}%`,
            delay: `${i * 0.7}s`,
            duration: `${5 + (i * 0.9) % 5}s`,
        }))
    )

    return (
        <div className="atmosphere">
            {particles.current.map((p, i) => (
                <div
                    key={i}
                    className="particle"
                    style={{
                        left: p.left,
                        animationDelay: p.delay,
                        animationDuration: p.duration,
                    }}
                />
            ))}
        </div>
    )
}

// ==============================================
// 🔊 AMBIENT HORROR SOUNDSCAPE
// ==============================================

// ==============================================
// 🔊 AMBIENT HORROR SOUNDSCAPE
// ==============================================

function AmbientHorror({ isMuted }) {
    const startedRef = useRef(false);

    const startAudio = useCallback(() => {
        if (startedRef.current) return;

        try {
            const ctx = audioCtx();
            if (!ctx) return;
            startedRef.current = true;

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(ambient.muted ? 0.0001 : 0.4, ctx.currentTime);
            masterGain.connect(ctx.destination);
            ambient.gain = masterGain;

            // --- LAYER 1: Deep Dread Drone ---
            const drone = ctx.createOscillator();
            const droneGain = ctx.createGain();
            drone.type = 'sawtooth';
            drone.frequency.setValueAtTime(40, ctx.currentTime);

            const droneLFO = ctx.createOscillator();
            const droneLFOGain = ctx.createGain();
            droneLFO.frequency.setValueAtTime(0.5, ctx.currentTime);
            droneLFOGain.gain.setValueAtTime(5, ctx.currentTime);
            droneLFO.connect(droneLFOGain);
            droneLFOGain.connect(drone.frequency);

            droneGain.gain.setValueAtTime(0.15, ctx.currentTime);
            const droneFilter = ctx.createBiquadFilter();
            droneFilter.type = 'lowpass';
            droneFilter.frequency.setValueAtTime(200, ctx.currentTime);

            drone.connect(droneFilter);
            droneFilter.connect(droneGain);
            droneGain.connect(masterGain);
            drone.start();
            droneLFO.start();

            // --- LAYER 2: Discordant "Strings" ---
            const createString = (freq, detune, gainVal) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                osc.detune.setValueAtTime(detune, ctx.currentTime);
                g.gain.setValueAtTime(0, ctx.currentTime);

                // Volume swells
                const now = ctx.currentTime;
                const swell = () => {
                    const t = ctx.currentTime;
                    g.gain.linearRampToValueAtTime(gainVal, t + 4 + Math.random() * 4);
                    g.gain.linearRampToValueAtTime(0, t + 8 + Math.random() * 4);
                };
                setInterval(swell, 12000);
                swell();

                osc.connect(g);
                g.connect(masterGain);
                osc.start();
            };
            createString(220, 5, 0.03);
            createString(223, -5, 0.03); // Minor second dissonance
            createString(311, 10, 0.02); // Tritone dissonance

            // --- LAYER 3: Metallic Shiver ---
            const shiverBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const shiverData = shiverBuffer.getChannelData(0);
            for (let i = 0; i < shiverBuffer.length; i++) shiverData[i] = Math.random() * 2 - 1;

            const shiver = ctx.createBufferSource();
            shiver.buffer = shiverBuffer;
            shiver.loop = true;

            const shiverFilter = ctx.createBiquadFilter();
            shiverFilter.type = 'bandpass';
            shiverFilter.frequency.setValueAtTime(3000, ctx.currentTime);
            shiverFilter.Q.setValueAtTime(12, ctx.currentTime);

            const shiverGain = ctx.createGain();
            shiverGain.gain.setValueAtTime(0.01, ctx.currentTime);

            // Rapid shivering amplitude modulation
            const shiverAM = ctx.createOscillator();
            const shiverAMGain = ctx.createGain();
            shiverAM.frequency.setValueAtTime(25, ctx.currentTime);
            shiverAMGain.gain.setValueAtTime(0.015, ctx.currentTime);
            shiverAM.connect(shiverAMGain);
            shiverAMGain.connect(shiverGain.gain);
            shiverAM.start();

            shiver.connect(shiverFilter);
            shiverFilter.connect(shiverGain);
            shiverGain.connect(masterGain);
            shiver.start();

            // --- LAYER 4: Heartbeat Pulse ---
            const createBeat = () => {
                if (ambient.muted || ambient.ducked) return;
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(55, ctx.currentTime);
                g.gain.setValueAtTime(0, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                const f = ctx.createBiquadFilter();
                f.type = 'lowpass';
                f.frequency.setValueAtTime(80, ctx.currentTime);
                osc.connect(f);
                f.connect(g);
                g.connect(masterGain);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            };
            setInterval(() => {
                createBeat();
                setTimeout(createBeat, 350);
            }, 1800);

            // --- LAYER 5: Ghostly Whispers ---
            const whisperGain = ctx.createGain();
            whisperGain.gain.setValueAtTime(0.005, ctx.currentTime);
            const whisperLFO = ctx.createOscillator();
            const whisperLFOG = ctx.createGain();
            whisperLFO.frequency.setValueAtTime(0.1, ctx.currentTime);
            whisperLFOG.gain.setValueAtTime(0.005, ctx.currentTime);
            whisperLFO.connect(whisperLFOG);
            whisperLFOG.connect(whisperGain.gain);
            whisperLFO.start();

            const shiver2 = ctx.createBufferSource();
            shiver2.buffer = shiverBuffer;
            shiver2.loop = true;
            const whisperFilter = ctx.createBiquadFilter();
            whisperFilter.type = 'highpass';
            whisperFilter.frequency.setValueAtTime(6000, ctx.currentTime);
            shiver2.connect(whisperFilter);
            whisperFilter.connect(whisperGain);
            whisperGain.connect(masterGain);
            shiver2.start();

            // --- LAYER 6: Distortion Grit (Lo-fi horror) ---
            const distortion = ctx.createWaveShaper();
            function makeDistortionCurve(amount) {
                const k = typeof amount === 'number' ? amount : 50;
                const n_samples = 44100;
                const curve = new Float32Array(n_samples);
                const deg = Math.PI / 180;
                for (let i = 0; i < n_samples; ++i) {
                    const x = i * 2 / n_samples - 1;
                    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
                }
                return curve;
            }
            distortion.curve = makeDistortionCurve(10);
            distortion.oversample = '4x';
            // We'll skip connecting high-res distortion for mobile performance,
            // just use a subtle lowpass grit.

        } catch (e) {
            console.warn("Horror Audio Pipeline failed", e);
        }
    }, []);

    useEffect(() => {
        const handleInteraction = () => {
            startAudio();
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [startAudio]);

    useEffect(() => {
        ambient.muted = isMuted;
        applyAmbientVolume();
    }, [isMuted]);

    return null;
}

// ====================================================
// 🕸️ Spider Webs — FULL EDGE COVERAGE
// ====================================================

function SpiderWebs() {
    return (
        <div className="spider-web-container">
            {/* TOP-LEFT corner — large dramatic web */}
            <svg className="web web-tl" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet">
                <g stroke="rgba(220,220,240,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round">
                    {/* Radial threads */}
                    <line x1="0" y1="0" x2="400" y2="20" />
                    <line x1="0" y1="0" x2="390" y2="50" />
                    <line x1="0" y1="0" x2="380" y2="80" />
                    <line x1="0" y1="0" x2="360" y2="120" />
                    <line x1="0" y1="0" x2="340" y2="150" />
                    <line x1="0" y1="0" x2="310" y2="180" />
                    <line x1="0" y1="0" x2="280" y2="220" />
                    <line x1="0" y1="0" x2="240" y2="250" />
                    <line x1="0" y1="0" x2="200" y2="290" />
                    <line x1="0" y1="0" x2="160" y2="320" />
                    <line x1="0" y1="0" x2="120" y2="350" />
                    <line x1="0" y1="0" x2="80" y2="380" />
                    <line x1="0" y1="0" x2="40" y2="400" />
                    <line x1="0" y1="0" x2="20" y2="400" />
                    <line x1="0" y1="0" x2="0" y2="400" />
                    {/* Concentric rings - highly dense */}
                    <path d="M 30 1 Q 28 15 20 30 Q 15 40 10 45 Q 5 50 1 30" />
                    <path d="M 60 2 Q 54 28 42 54 Q 30 76 18 90 Q 8 100 2 60" />
                    <path d="M 95 3 Q 85 40 70 75 Q 55 110 35 130 Q 15 150 4 90" />
                    <path d="M 130 5 Q 116 50 95 100 Q 74 145 50 175 Q 30 200 5 130" />
                    <path d="M 170 6 Q 150 65 125 125 Q 100 185 65 220 Q 40 250 8 170" />
                    <path d="M 210 8 Q 186 75 155 150 Q 120 220 82 268 Q 52 305 8 210" />
                    <path d="M 255 10 Q 225 88 185 175 Q 145 255 100 310 Q 65 350 10 255" />
                    <path d="M 300 12 Q 265 100 220 200 Q 172 292 118 354 Q 78 395 12 300" />
                    <path d="M 345 15 Q 300 115 250 225 Q 200 325 140 375 Q 100 400 15 350" />
                    <path d="M 380 18 Q 335 130 280 250 Q 220 360 155 398" />
                    {/* Cross-threads for extra complexity */}
                    <path d="M 10 200 Q 100 100 200 10" strokeWidth="0.5" opacity="0.5" />
                    <path d="M 50 350 Q 150 250 250 150" strokeWidth="0.5" opacity="0.5" />
                </g>
            </svg>

            {/* TOP-RIGHT corner — large dramatic web */}
            <svg className="web web-tr" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMin meet">
                <g stroke="rgba(220,220,240,0.55)" strokeWidth="1.2" fill="none" strokeLinecap="round">
                    <line x1="400" y1="0" x2="0" y2="20" />
                    <line x1="400" y1="0" x2="10" y2="50" />
                    <line x1="400" y1="0" x2="20" y2="80" />
                    <line x1="400" y1="0" x2="40" y2="120" />
                    <line x1="400" y1="0" x2="60" y2="150" />
                    <line x1="400" y1="0" x2="90" y2="180" />
                    <line x1="400" y1="0" x2="120" y2="220" />
                    <line x1="400" y1="0" x2="160" y2="250" />
                    <line x1="400" y1="0" x2="200" y2="290" />
                    <line x1="400" y1="0" x2="240" y2="320" />
                    <line x1="400" y1="0" x2="280" y2="350" />
                    <line x1="400" y1="0" x2="320" y2="380" />
                    <line x1="400" y1="0" x2="360" y2="400" />
                    <line x1="400" y1="0" x2="380" y2="400" />

                    <path d="M 370 1 Q 372 15 380 30 Q 385 40 390 45 Q 395 50 399 30" />
                    <path d="M 340 2 Q 346 28 358 54 Q 370 76 382 90 Q 392 100 398 60" />
                    <path d="M 305 3 Q 315 40 330 75 Q 345 110 365 130 Q 385 150 396 90" />
                    <path d="M 270 5 Q 284 50 305 100 Q 326 145 350 175 Q 370 200 395 130" />
                    <path d="M 230 6 Q 250 65 275 125 Q 300 185 335 220 Q 360 250 392 170" />
                    <path d="M 190 8 Q 214 75 245 150 Q 280 220 318 268 Q 348 305 392 210" />
                    <path d="M 145 10 Q 175 88 215 175 Q 255 255 300 310 Q 335 350 390 255" />
                    <path d="M 100 12 Q 135 100 180 200 Q 228 292 282 354 Q 322 395 388 300" />
                    <path d="M 55 15 Q 100 115 150 225 Q 200 325 260 375 Q 300 400 385 350" />
                    <path d="M 20 18 Q 65 130 120 250 Q 180 360 245 398" />
                </g>
            </svg>

            {/* BOTTOM-LEFT corner web */}
            <svg className="web web-bl" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMax meet">
                <g stroke="rgba(220,220,240,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round">
                    <line x1="0" y1="300" x2="300" y2="280" />
                    <line x1="0" y1="300" x2="280" y2="220" />
                    <line x1="0" y1="300" x2="220" y2="140" />
                    <line x1="0" y1="300" x2="140" y2="70" />
                    <line x1="0" y1="300" x2="60" y2="20" />
                    <line x1="0" y1="300" x2="300" y2="150" strokeWidth="0.5" opacity="0.4" />
                    <line x1="0" y1="300" x2="150" y2="0" strokeWidth="0.5" opacity="0.4" />

                    <path d="M 50 298 Q 46 280 52 264 Q 30 276 12 295" />
                    <path d="M 80 294 Q 70 265 80 240 Q 50 260 30 288" />
                    <path d="M 110 290 Q 100 258 110 222 Q 68 248 42 280" />
                    <path d="M 145 284 Q 130 245 140 205 Q 90 235 60 270" />
                    <path d="M 180 278 Q 162 235 172 185 Q 115 220 80 260" />
                    <path d="M 220 270 Q 195 220 205 160 Q 140 200 100 245" />
                    <path d="M 260 260 Q 230 200 240 130 Q 170 170 120 220" />
                </g>
            </svg>

            {/* BOTTOM-RIGHT corner web */}
            <svg className="web web-br" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMax meet">
                <g stroke="rgba(220,220,240,0.5)" strokeWidth="1.2" fill="none" strokeLinecap="round">
                    <line x1="300" y1="300" x2="0" y2="280" />
                    <line x1="300" y1="300" x2="20" y2="220" />
                    <line x1="300" y1="300" x2="80" y2="140" />
                    <line x1="300" y1="300" x2="160" y2="70" />
                    <line x1="300" y1="300" x2="240" y2="20" />
                    <line x1="300" y1="300" x2="0" y2="150" strokeWidth="0.5" opacity="0.4" />
                    <line x1="300" y1="300" x2="150" y2="0" strokeWidth="0.5" opacity="0.4" />

                    <path d="M 250 298 Q 254 280 248 264 Q 270 276 288 295" />
                    <path d="M 220 294 Q 230 265 220 240 Q 250 260 270 288" />
                    <path d="M 190 290 Q 200 258 190 222 Q 232 248 258 280" />
                    <path d="M 155 284 Q 170 245 160 205 Q 210 235 240 270" />
                    <path d="M 120 278 Q 138 235 128 185 Q 185 220 220 260" />
                </g>
            </svg>

            {/* RIGHT SIDE thin web tendrils */}
            <svg className="web web-right" viewBox="0 0 60 800" xmlns="http://www.w3.org/2000/svg">
                <g stroke="rgba(220,220,240,0.25)" strokeWidth="1" fill="none">
                    <line x1="60" y1="0" x2="0" y2="200" />
                    <line x1="60" y1="100" x2="0" y2="350" />
                    <line x1="60" y1="250" x2="10" y2="500" />
                    <line x1="60" y1="400" x2="5" y2="650" />
                    <path d="M 60 50 Q 40 100 20 150 Q 10 175 0 180" />
                    <path d="M 60 200 Q 35 280 15 360 Q 5 390 0 400" />
                    <path d="M 60 450 Q 40 520 20 590 Q 8 620 0 640" />
                </g>
            </svg>

            {/* LEFT SIDE thin web tendrils */}
            <svg className="web web-left" viewBox="0 0 60 800" xmlns="http://www.w3.org/2000/svg">
                <g stroke="rgba(220,220,240,0.25)" strokeWidth="1" fill="none">
                    <line x1="0" y1="200" x2="60" y2="0" />
                    <line x1="0" y1="350" x2="60" y2="100" />
                    <line x1="10" y1="500" x2="60" y2="250" />
                    <line x1="5" y1="650" x2="60" y2="400" />
                    <path d="M 0 180 Q 20 175 40 150 Q 50 100 60 50" />
                    <path d="M 0 400 Q 5 390 15 360 Q 35 280 60 200" />
                </g>
            </svg>
        </div>
    )
}

// ====================================================
// ⚡ Lightning Flash + Overlays
// ====================================================

function ScreenOverlays() {
    const [flash, setFlash] = useState(false)

    useEffect(() => {
        const scheduleFlash = () => {
            const delay = 8000 + Math.random() * 20000
            setTimeout(() => {
                setFlash(true)
                setTimeout(() => setFlash(false), 120)
                setTimeout(() => {
                    setFlash(true)
                    setTimeout(() => setFlash(false), 80)
                }, 180)
                scheduleFlash()
            }, delay)
        }
        scheduleFlash()
    }, [])

    return (
        <>
            <div className="film-grain" />
            <div className="vignette-overlay" />
            {flash && <div className="lightning-flash" />}
        </>
    )
}

// ====================================================
// 💀 Top bar — sound + language
// ====================================================

function TopBar({ isMuted, onToggleMute }) {
    const { lang, setLang, t } = useI18n()
    return (
        <div className="topbar">
            <button
                type="button"
                className={`sound-toggle${isMuted ? ' is-muted' : ''}`}
                onClick={onToggleMute}
                aria-pressed={!isMuted}
                aria-label={isMuted ? t('soundOff') : t('soundOn')}
                title={isMuted ? t('soundOff') : t('soundOn')}
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
            <div className="lang-switch" role="radiogroup" aria-label={t('language')}>
                {LANGS.map((l) => (
                    <button
                        key={l.code}
                        type="button"
                        role="radio"
                        aria-checked={lang === l.code}
                        className={`lang-option${lang === l.code ? ' is-active' : ''}`}
                        lang={l.code}
                        dir={l.dir}
                        onClick={() => setLang(l.code)}
                    >
                        {l.native}
                    </button>
                ))}
            </div>
        </div>
    )
}

// ====================================================
// 💀 Header
// ====================================================

function Header() {
    const { t } = useI18n()
    return (
        <header className="header">
            <div className="header-skull" aria-hidden="true">💀</div>
            <h1>{t('title')}</h1>
            <p>{t('subtitle')}</p>
        </header>
    )
}

// ====================================================
// 💀 Confessional Input
// ====================================================

function playBurialThud() {
    if (ambient.muted) return
    try {
        const ctx = audioCtx()
        if (!ctx) return
        // Deep thud
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(60, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5)
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.5)
        // Bell tone
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.type = 'sine'
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.frequency.setValueAtTime(440, ctx.currentTime + 0.1)
        osc2.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 1.2)
        gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1)
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
        osc2.start(ctx.currentTime + 0.1)
        osc2.stop(ctx.currentTime + 1.2)
    } catch (e) { /* no audio support, no problem */ }
}

function Confessional({ onSubmit, isLoading }) {
    const { lang, t } = useI18n()
    const [mistake, setMistake] = useState('')
    const [ripple, setRipple] = useState(false)
    const [mic, setMic] = useState({ state: 'idle', seconds: 0, error: null }) // idle | starting | recording | transcribing
    const recorderRef = useRef(null)
    const placeholders = t('placeholders')
    const [placeholder, setPlaceholder] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setPlaceholder((i) => (i + 1) % placeholders.length), 3500)
        return () => clearInterval(id)
    }, [placeholders.length])

    // Leaving the page mid-recording must release the microphone.
    useEffect(() => () => recorderRef.current?.stop(), [])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!mistake.trim() || isLoading || mic.state !== 'idle') return
        // Trigger stone button ripple/shake
        setRipple(true)
        setTimeout(() => setRipple(false), 400)
        playBurialThud()
        onSubmit(mistake.trim())
        setMistake('')
    }

    const toggleMic = async () => {
        if (mic.state === 'recording') {
            recorderRef.current?.stop()
            return
        }
        if (mic.state !== 'idle') return
        if (!micSupported()) {
            setMic({ state: 'idle', seconds: 0, error: t('micUnsupported') })
            return
        }
        setMic({ state: 'starting', seconds: 0, error: null })
        duckAmbient(true)
        let recorder
        try {
            recorder = await startRecording({ maxSeconds: 30 })
        } catch (e) {
            duckAmbient(false)
            setMic({ state: 'idle', seconds: 0, error: t('micDenied') })
            return
        }
        recorderRef.current = recorder
        setMic({ state: 'recording', seconds: 0, error: null })
        const tick = setInterval(() => setMic((m) => (m.state === 'recording'
            ? { ...m, seconds: Math.floor(recorder.elapsed()) } : m)), 250)
        const wav = await recorder.done
        clearInterval(tick)
        recorderRef.current = null
        duckAmbient(false)
        if (!wav) {
            setMic({ state: 'idle', seconds: 0, error: null })
            return
        }
        setMic({ state: 'transcribing', seconds: 0, error: null })
        try {
            const res = await fetch(`${API_URL}/api/transcribe?lang=${lang}`, {
                method: 'POST',
                headers: { 'Content-Type': 'audio/wav', 'X-Session-Id': SESSION_ID, 'X-Lang': lang },
                body: wav,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || t('genericError'))
            setMistake((prev) => `${prev.trim() ? `${prev.trim()} ` : ''}${data.text}`.slice(0, MAX_MISTAKE_LENGTH))
            setMic({ state: 'idle', seconds: 0, error: null })
        } catch (e) {
            setMic({ state: 'idle', seconds: 0, error: e.message || t('genericError') })
        }
    }

    const answerLang = mistake.trim().length > 3 ? guessAnswerLang(mistake, lang) : null
    const busyMic = mic.state !== 'idle'

    return (
        <motion.div
            className="confessional"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
        >
            <form className="confessional-box" onSubmit={handleSubmit}>
                <label className="confessional-label" htmlFor="confession">
                    <span aria-hidden="true">🕯️</span> {t('confessLabel')}
                </label>
                <div className={`textarea-wrap${mic.state === 'recording' ? ' is-recording' : ''}`}>
                    <textarea
                        id="confession"
                        className="confessional-textarea"
                        placeholder={placeholders[placeholder]}
                        value={mistake}
                        onChange={(e) => setMistake(e.target.value)}
                        maxLength={MAX_MISTAKE_LENGTH}
                        disabled={isLoading || busyMic}
                        dir="auto"
                    />
                    {busyMic && (
                        <div className="mic-overlay" aria-live="polite">
                            {mic.state === 'recording' && (
                                <>
                                    <span className="rec-dot" aria-hidden="true" />
                                    <span className="rec-time">0:{String(mic.seconds).padStart(2, '0')}</span>
                                    <span>{t('micListening')}</span>
                                </>
                            )}
                            {mic.state === 'starting' && <span>🎙️</span>}
                            {mic.state === 'transcribing' && (
                                <>
                                    <span className="mic-spinner" aria-hidden="true" />
                                    <span>{t('micTranscribing')}</span>
                                </>
                            )}
                        </div>
                    )}
                    <button
                        type="button"
                        className={`mic-btn mic-btn--${mic.state}`}
                        onClick={toggleMic}
                        disabled={isLoading || mic.state === 'transcribing' || mic.state === 'starting'}
                        aria-label={mic.state === 'recording' ? t('stop') : t('micStart')}
                        title={mic.state === 'recording' ? t('stop') : t('micStart')}
                    >
                        {mic.state === 'recording' ? <span className="mic-stop-square" /> : <MicIcon />}
                    </button>
                </div>
                <div className="textarea-footer">
                    <span className="char-count">{mistake.length}/{MAX_MISTAKE_LENGTH}</span>
                    {answerLang && (
                        <span className="lang-hint">
                            {t('answerIn')}: <b>{t('langNames')[answerLang]}</b>
                        </span>
                    )}
                </div>
                {mic.error && <p className="mic-error" role="alert">{mic.error}</p>}
                <button
                    type="submit"
                    className={`bury-btn${ripple ? ' bury-btn--strike' : ''}`}
                    disabled={!mistake.trim() || isLoading || busyMic}
                >
                    <span className="btn-skull" aria-hidden="true">💀</span>
                    <span className="btn-text">{t('bury')}</span>
                    <span className="btn-skull" aria-hidden="true">💀</span>
                </button>
            </form>
        </motion.div>
    )
}

function MicIcon() {
    return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
        </svg>
    )
}
// ====================================================
// 💀 Stickman SVG Component
// ====================================================

function Stickman({ x, delay = 0, flipped = false, shovelAngle = 0 }) {
    return (
        <g transform={`translate(${x}, 0) ${flipped ? 'scale(-1,1)' : ''}`} style={{ animationDelay: `${delay}s` }}>
            {/* Head */}
            <circle cx="0" cy="-52" r="8" fill="none" stroke="#c8c8d8" strokeWidth="2" />
            {/* Body */}
            <line x1="0" y1="-44" x2="0" y2="-18" stroke="#c8c8d8" strokeWidth="2.5" />
            {/* Left leg */}
            <line x1="0" y1="-18" x2="-8" y2="0" stroke="#c8c8d8" strokeWidth="2.5" />
            {/* Right leg */}
            <line x1="0" y1="-18" x2="8" y2="0" stroke="#c8c8d8" strokeWidth="2.5" />
            {/* Left arm — static */}
            <line x1="0" y1="-38" x2="-12" y2="-26" stroke="#c8c8d8" strokeWidth="2" />
            {/* Right arm — animated digging */}
            <g className="dig-arm" style={{ transformOrigin: '0px -38px', animationDelay: `${delay}s` }}>
                <line x1="0" y1="-38" x2="14" y2="-24" stroke="#c8c8d8" strokeWidth="2" />
                {/* Shovel handle */}
                <line
                    x1="14" y1="-24"
                    x2={14 + Math.cos((shovelAngle * Math.PI) / 180) * 20}
                    y2={-24 + Math.sin((shovelAngle * Math.PI) / 180) * 20}
                    stroke="#8888aa"
                    strokeWidth="2"
                />
                {/* Shovel blade */}
                <rect
                    x={14 + Math.cos((shovelAngle * Math.PI) / 180) * 20 - 5}
                    y={-24 + Math.sin((shovelAngle * Math.PI) / 180) * 20}
                    width="10" height="6"
                    fill="#4a1a7a"
                    stroke="#7733bb"
                    strokeWidth="1"
                    transform={`rotate(${shovelAngle}, ${14 + Math.cos((shovelAngle * Math.PI) / 180) * 20}, ${-24 + Math.sin((shovelAngle * Math.PI) / 180) * 20})`}
                />
            </g>
        </g>
    )
}

// ====================================================
// 💀 Dirt Particle Burst
// ====================================================

function DirtParticles() {
    const dirticles = Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * 360
        const dist = 30 + Math.random() * 25
        return { angle, dist, delay: Math.random() * 0.8 }
    })

    return (
        <>
            {dirticles.map((d, i) => (
                <div
                    key={i}
                    className="dirt-particle"
                    style={{
                        '--angle': `${d.angle}deg`,
                        '--dist': `${d.dist}px`,
                        animationDelay: `${d.delay}s`,
                    }}
                />
            ))}
        </>
    )
}

// ====================================================
// 💀 Digging Scene (Loading State)
// ====================================================

function DiggingScene() {
    const { t } = useI18n()
    const messages = t('loading')
    const [msgIndex, setMsgIndex] = useState(() => Math.floor(Math.random() * messages.length))
    const [phase, setPhase] = useState(0) // 0=digging, 1=coffin lowering

    useEffect(() => {
        const msgInterval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % messages.length)
        }, 1800)
        const phaseInterval = setInterval(() => {
            setPhase(p => (p + 1) % 3)
        }, 2400)
        return () => {
            clearInterval(msgInterval)
            clearInterval(phaseInterval)
        }
    }, [messages.length])

    return (
        <motion.div
            className="digging-scene"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Scene container */}
            <div className="scene-wrapper">
                {/* Ground line */}
                <div className="ground-line" />

                {/* Grave pit */}
                <div className="grave-pit">
                    <div className="grave-pit-inner" />
                </div>

                {/* Dirt particles burst zone */}
                <div className="dirt-burst-zone">
                    <DirtParticles />
                </div>

                {/* Stickmen SVG */}
                <svg
                    className="stickmen-svg"
                    viewBox="-100 -70 200 80"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Left stickman — digging into pit */}
                    <g className="stickman-dig-anim">
                        <Stickman x={-38} delay={0} shovelAngle={45} />
                    </g>
                    {/* Right stickman — throwing dirt */}
                    <g className="stickman-dig-anim-b">
                        <Stickman x={38} delay={0.6} flipped shovelAngle={30} />
                    </g>
                    {/* Middle stickman — supervisor, just standing */}
                    <g className="stickman-watch">
                        <circle cx="0" cy="-52" r="8" fill="none" stroke="#ffaa00" strokeWidth="2" />
                        <line x1="0" y1="-44" x2="0" y2="-18" stroke="#ffaa00" strokeWidth="2.5" />
                        <line x1="0" y1="-18" x2="-8" y2="0" stroke="#ffaa00" strokeWidth="2.5" />
                        <line x1="0" y1="-18" x2="8" y2="0" stroke="#ffaa00" strokeWidth="2.5" />
                        <line x1="0" y1="-38" x2="-12" y2="-30" stroke="#ffaa00" strokeWidth="2" />
                        <line x1="0" y1="-38" x2="12" y2="-30" stroke="#ffaa00" strokeWidth="2" />
                        {/* Crown / top hat */}
                        <rect x="-7" y="-67" width="14" height="8" fill="none" stroke="#ffaa00" strokeWidth="1.5" />
                        <line x1="-10" y1="-60" x2="10" y2="-60" stroke="#ffaa00" strokeWidth="1.5" />
                    </g>
                    {/* Coffin being lowered (phase 1+) */}
                    {phase >= 1 && (
                        <motion.g
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8, ease: 'easeIn' }}
                        >
                            <rect x="-14" y="-12" width="28" height="18" rx="2" fill="#1a1a2e" stroke="#4a1a7a" strokeWidth="1.5" />
                            <line x1="-14" y1="-4" x2="14" y2="-4" stroke="#4a1a7a" strokeWidth="1" />
                            <text x="0" y="0" textAnchor="middle" fontSize="8" fill="#7733bb">⚰️</text>
                        </motion.g>
                    )}
                </svg>

                {/* Flying dirt clumps */}
                <div className="dirt-clumps">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="dirt-clump"
                            style={{
                                '--i': i,
                                animationDelay: `${i * 0.35}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Candles on both sides */}
                <div className="scene-candle scene-candle-left">🕯️</div>
                <div className="scene-candle scene-candle-right">🕯️</div>
            </div>

            <motion.p
                key={msgIndex}
                className="loading-text"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
            >
                {messages[msgIndex]}
            </motion.p>

            <div className="loading-dots">
                <span /><span /><span />
            </div>
        </motion.div>
    )
}

// ====================================================
// 🔊 The narrator — reads the eulogy aloud
// ====================================================
//
// One <audio> element for the page, so two narrators never talk over each other.
// play() runs inside the tap itself (not after an await), which is what iOS needs;
// the server streams the MP3 as Gemini speaks, so the first words arrive in ~2 s.

const narratorAudio = typeof Audio !== 'undefined' ? new Audio() : null
let narratorOwner = null

function stopNarrator() {
    if (!narratorAudio) return
    narratorAudio.pause()
    narratorAudio.removeAttribute('src')
    narratorAudio.load()
    narratorOwner = null
    duckAmbient(false)
}

function useNarrator(grave) {
    const { lang } = useI18n()
    const [state, setState] = useState(() => (narratorOwner === grave.id && narratorAudio && !narratorAudio.paused ? 'playing' : 'idle'))

    useEffect(() => {
        if (!narratorAudio) return
        const mine = () => narratorOwner === grave.id
        const onPlaying = () => mine() && setState('playing')
        const onWaiting = () => mine() && setState((s) => (s === 'playing' ? 'loading' : s))
        const onEnded = () => { if (mine()) { setState('idle'); narratorOwner = null; duckAmbient(false) } }
        const onError = () => { if (mine() && narratorAudio.getAttribute('src')) { setState('error'); narratorOwner = null; duckAmbient(false) } }
        const onEmptied = () => { if (!mine()) setState((s) => (s === 'error' ? s : 'idle')) }
        narratorAudio.addEventListener('playing', onPlaying)
        narratorAudio.addEventListener('waiting', onWaiting)
        narratorAudio.addEventListener('ended', onEnded)
        narratorAudio.addEventListener('error', onError)
        narratorAudio.addEventListener('emptied', onEmptied)
        return () => {
            narratorAudio.removeEventListener('playing', onPlaying)
            narratorAudio.removeEventListener('waiting', onWaiting)
            narratorAudio.removeEventListener('ended', onEnded)
            narratorAudio.removeEventListener('error', onError)
            narratorAudio.removeEventListener('emptied', onEmptied)
        }
    }, [grave.id])

    const toggle = () => {
        if (!narratorAudio) return
        if (narratorOwner === grave.id && (state === 'playing' || state === 'loading')) {
            stopNarrator()
            setState('idle')
            return
        }
        stopNarrator()
        narratorOwner = grave.id
        setState('loading')
        duckAmbient(true)
        narratorAudio.src = `${API_URL}/api/graves/${grave.id}/voice.mp3?s=${encodeURIComponent(SESSION_ID)}&lang=${lang}`
        narratorAudio.play().catch((e) => {
            if (e.name === 'AbortError' || narratorOwner !== grave.id) return
            setState('error')
            narratorOwner = null
            duckAmbient(false)
        })
    }

    return { state, toggle, available: !!narratorAudio && grave.voiceAvailable && !grave.isLocal }
}

function NarratorButton({ narrator, className = 'action-btn action-btn--primary' }) {
    const { t } = useI18n()
    const active = narrator.state === 'playing' || narrator.state === 'loading'
    return (
        <button type="button" className={`${className}${active ? ' is-active' : ''}`} onClick={narrator.toggle} aria-pressed={active}>
            {narrator.state === 'playing' ? (
                <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
            ) : narrator.state === 'loading' ? (
                <span className="mic-spinner" aria-hidden="true" />
            ) : (
                <span className="btn-icon" aria-hidden="true">🔊</span>
            )}
            <span className="btn-text">{active ? t('stop') : t('listen')}</span>
        </button>
    )
}

function NarratorStatus({ narrator }) {
    const { t } = useI18n()
    if (narrator.state === 'loading') return <p className="narrator-status" aria-live="polite">{t('narratorWarming')}</p>
    if (narrator.state === 'error') return <p className="narrator-status narrator-status--error" role="alert">{t('narratorError')}</p>
    return null
}

// ====================================================
// 💀 Scroll Modal — Full Funeral Speech
// ====================================================

function ScrollModal({ grave, narrator, onClose }) {
    const { t } = useI18n()
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    return (
        <motion.div
            className="scroll-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <motion.div
                className="scroll-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('scrollTitle')}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, duration: 0.5 }}
            >
                {/* Scroll top curl */}
                <div className="scroll-curl scroll-curl-top">
                    <div className="scroll-curl-line" />
                </div>

                <div className="scroll-body">
                    <div className="scroll-header">
                        <div className="scroll-icon" aria-hidden="true">📜</div>
                        <h3 className="scroll-title">{t('scrollTitle')}</h3>
                        <div className="scroll-divider" aria-hidden="true">✦ ✦ ✦</div>
                    </div>

                    <p className="scroll-text" lang={grave.lang} dir="auto">{grave.eulogy}</p>

                    <div className="scroll-footer">
                        {narrator.available && <NarratorButton narrator={narrator} className="scroll-listen" />}
                        <NarratorStatus narrator={narrator} />
                        <div className="scroll-seal" aria-hidden="true">⚰️</div>
                        <p className="scroll-signed">{t('scrollSigned')}, {new Date().getFullYear()}</p>
                    </div>
                </div>

                {/* Scroll bottom curl */}
                <div className="scroll-curl scroll-curl-bottom">
                    <div className="scroll-curl-line" />
                </div>

                <button className="scroll-close" onClick={onClose} title={t('close')} aria-label={t('close')}>
                    ✕
                </button>
            </motion.div>
        </motion.div>
    )
}

// ====================================================
// 💀 Gravestone Component
// ====================================================

function Gravestone({ data, onBuryAnother }) {
    const { lang, t } = useI18n()
    const [showScroll, setShowScroll] = useState(false)
    const [toast, setToast] = useState(null)
    const narrator = useNarrator(data)

    // Leaving the grave (bury another, open an older one) silences its narrator.
    useEffect(() => () => { if (narratorOwner === data.id) stopNarrator() }, [data.id])

    useEffect(() => {
        if (!toast) return
        const id = setTimeout(() => setToast(null), 2600)
        return () => clearTimeout(id)
    }, [toast])

    const onShare = async () => {
        try {
            const result = await shareGrave(data, t, lang)
            if (result === 'saved') setToast(t('shareSaved'))
        } catch (e) {
            setToast(t('genericError'))
        }
    }

    return (
        <>
            <AnimatePresence>
                {showScroll && (
                    <ScrollModal
                        grave={data}
                        narrator={narrator}
                        onClose={() => setShowScroll(false)}
                    />
                )}
            </AnimatePresence>

            <motion.div
                className="graveyard"
                initial={{ opacity: 0, y: 60, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* Ground with stickmen mourners */}
                <div className="gravestone-scene">
                    {/* Mourner stickmen */}
                    <svg className="mourner-svg" viewBox="-80 -60 160 65" xmlns="http://www.w3.org/2000/svg">
                        {/* Left mourner */}
                        <g opacity="0.5">
                            <circle cx="-45" cy="-50" r="7" fill="none" stroke="#8888aa" strokeWidth="1.5" />
                            <line x1="-45" y1="-43" x2="-45" y2="-20" stroke="#8888aa" strokeWidth="2" />
                            <line x1="-45" y1="-20" x2="-51" y2="0" stroke="#8888aa" strokeWidth="2" />
                            <line x1="-45" y1="-20" x2="-39" y2="0" stroke="#8888aa" strokeWidth="2" />
                            <line x1="-45" y1="-33" x2="-56" y2="-25" stroke="#8888aa" strokeWidth="1.5" />
                            <line x1="-45" y1="-33" x2="-34" y2="-25" stroke="#8888aa" strokeWidth="1.5" />
                        </g>
                        {/* Right mourner  */}
                        <g opacity="0.5">
                            <circle cx="45" cy="-50" r="7" fill="none" stroke="#8888aa" strokeWidth="1.5" />
                            <line x1="45" y1="-43" x2="45" y2="-20" stroke="#8888aa" strokeWidth="2" />
                            <line x1="45" y1="-20" x2="39" y2="0" stroke="#8888aa" strokeWidth="2" />
                            <line x1="45" y1="-20" x2="51" y2="0" stroke="#8888aa" strokeWidth="2" />
                            <line x1="45" y1="-33" x2="34" y2="-25" stroke="#8888aa" strokeWidth="1.5" />
                            <line x1="45" y1="-33" x2="56" y2="-25" stroke="#8888aa" strokeWidth="1.5" />
                        </g>
                        {/* Central mourner with handkerchief */}
                        <g className="mourner-sway">
                            <circle cx="0" cy="-52" r="7" fill="none" stroke="#c8c8d8" strokeWidth="1.5" />
                            <line x1="0" y1="-45" x2="0" y2="-20" stroke="#c8c8d8" strokeWidth="2" />
                            <line x1="0" y1="-20" x2="-7" y2="0" stroke="#c8c8d8" strokeWidth="2" />
                            <line x1="0" y1="-20" x2="7" y2="0" stroke="#c8c8d8" strokeWidth="2" />
                            <line x1="0" y1="-33" x2="-14" y2="-26" stroke="#c8c8d8" strokeWidth="1.5" />
                            <line x1="0" y1="-33" x2="14" y2="-38" stroke="#c8c8d8" strokeWidth="1.5" />
                            {/* Handkerchief */}
                            <text x="15" y="-38" fontSize="8" fill="#e8e8f0">🤧</text>
                        </g>
                    </svg>
                </div>

                <motion.div
                    className="gravestone tombstone-clickable"
                    role="button"
                    tabIndex={0}
                    initial={{ rotateX: 30 }}
                    animate={{ rotateX: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    onClick={() => setShowScroll(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowScroll(true) } }}
                    title={t('tapHint')}
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <h2 className="grave-rip">{t('rip')}</h2>
                    <div className="grave-content" lang={data.lang} dir="auto">
                        <div className="grave-mistake">{data.mistake}</div>
                        <div className="grave-dates">{data.born} — {data.died}</div>
                        <p className="grave-epitaph">{data.epitaph}</p>
                    </div>
                    {data.causeOfDeath && (
                        <div className="grave-cause">
                            <span className="grave-cause-label">{t('causeLabel')}</span>
                            <span lang={data.lang} dir="auto">{data.causeOfDeath}</span>
                        </div>
                    )}
                    {/* Click hint */}
                    <div className="tombstone-click-hint">
                        <span aria-hidden="true">📜</span> {t('tapHint')}
                    </div>
                </motion.div>

                {/* Ground mound */}
                <div className="grave-mound" />

                {/* Candles */}
                <div className="grave-candles" aria-hidden="true">
                    <div className="grave-candle">🕯️</div>
                    <div className="grave-candle" style={{ animationDelay: '0.7s' }}>🕯️</div>
                    <div className="grave-candle" style={{ animationDelay: '1.3s' }}>🕯️</div>
                </div>

                {data.isLocal && <p className="offline-note">{t('offline')}</p>}

                <motion.div
                    className="grave-actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    {narrator.available && <NarratorButton narrator={narrator} />}
                    <button type="button" className="action-btn" onClick={() => setShowScroll(true)}>
                        <span className="btn-icon" aria-hidden="true">📜</span>
                        <span className="btn-text">{t('readEulogy')}</span>
                    </button>
                    <button type="button" className="action-btn" onClick={onShare}>
                        <span className="btn-icon" aria-hidden="true">📤</span>
                        <span className="btn-text">{t('share')}</span>
                    </button>
                    <button type="button" className="action-btn" onClick={onBuryAnother}>
                        <span className="btn-icon" aria-hidden="true">⚰️</span>
                        <span className="btn-text">{t('buryAnother')}</span>
                    </button>
                </motion.div>
                <NarratorStatus narrator={narrator} />
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            className="toast"
                            role="status"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                        >
                            {toast}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    )
}

// ====================================================
// 💀 Cemetery — Grave History
// ====================================================

function Cemetery({ graves, onSelect, onDelete }) {
    const { t } = useI18n()
    if (graves.length === 0) return null

    return (
        <motion.section
            className="cemetery-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
        >
            <h2 className="cemetery-title"><span aria-hidden="true">🪦</span> {t('cemeteryTitle')}</h2>
            <p className="cemetery-subtitle">{t('cemeterySubtitle')}</p>
            <div className="cemetery-grid">
                {graves.map((grave, i) => (
                    <motion.div
                        key={grave.id || i}
                        className="mini-grave"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 8) * 0.06 }}
                        whileHover={{ scale: 1.04, y: -4 }}
                        layout
                    >
                        <button type="button" className="mini-grave-content" onClick={() => onSelect(grave)}>
                            <span className="mini-grave-rip" aria-hidden="true">✝</span>
                            <span className="mini-grave-name" lang={grave.lang} dir="auto">{grave.mistake}</span>
                            <span className="mini-grave-date" lang={grave.lang}>{grave.died}</span>
                        </button>
                        <button
                            type="button"
                            className="mini-grave-delete"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(grave.id)
                            }}
                            title={t('deleteGrave')}
                            aria-label={t('deleteGrave')}
                        >
                            ✕
                        </button>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    )
}

// ====================================================
// 💀 Main App
// ====================================================

export default function App() {
    const [lang, setLangState] = useState(initialLang)
    const [view, setView] = useState('confess') // 'confess' | 'loading' | 'funeral'
    const [currentGrave, setCurrentGrave] = useState(null)
    const [graves, setGraves] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [isMuted, setIsMuted] = useState(() => {
        try { return localStorage.getItem('funeral-muted') === '1' } catch { return false }
    })

    const t = translator(lang)
    currentLang = lang

    useEffect(() => {
        const meta = langMeta(lang)
        document.documentElement.lang = lang
        document.documentElement.dir = meta.dir
        document.title = t('title')
        try { localStorage.setItem('funeral-lang', lang) } catch { /* private mode */ }
    }, [lang, t])

    const setLang = useCallback((code) => {
        setLangState(code)
        setError(null)
    }, [])

    const toggleMute = () => {
        setIsMuted((m) => {
            try { localStorage.setItem('funeral-muted', m ? '0' : '1') } catch { /* private mode */ }
            return !m
        })
    }

    const loadGraves = useCallback(async () => {
        try {
            const data = await apiFetch('/api/graves')
            setGraves(data)
        } catch (err) {
            console.error('Failed to load graves:', err)
        }
    }, [])

    useEffect(() => {
        loadGraves()
    }, [loadGraves])

    const handleBury = async (mistake) => {
        setLoading(true)
        setError(null)
        setView('loading')

        try {
            const data = await apiFetch('/api/bury', {
                method: 'POST',
                body: JSON.stringify({ mistake, uiLang: lang }),
            })
            setCurrentGrave(data)
            setView('funeral')
            loadGraves()
        } catch (err) {
            setError(err.message || t('genericError'))
            setView('confess')
        } finally {
            // Without this the confessional stayed disabled after the first burial.
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        try {
            await apiFetch(`/api/graves/${id}`, { method: 'DELETE' })
            setGraves(prev => prev.filter(g => g.id !== id))
        } catch (err) {
            console.error('Delete error:', err)
        }
    }

    return (
        <I18nContext.Provider value={{ lang, t, setLang }}>
            <div className="app-container">
                <AmbientHorror isMuted={isMuted} />
                <ScreenOverlays />
                <SpiderWebs />
                <Particles />

                <main className="main-content">
                    <TopBar isMuted={isMuted} onToggleMute={toggleMute} />
                    <Header />

                    <AnimatePresence mode="wait">
                        {view === 'confess' && (
                            <Confessional key="confess" onSubmit={handleBury} isLoading={loading} />
                        )}
                        {view === 'loading' && (
                            <DiggingScene key="loading" />
                        )}
                        {view === 'funeral' && currentGrave && (
                            <Gravestone
                                key={`funeral-${currentGrave.id}`}
                                data={currentGrave}
                                onBuryAnother={() => setView('confess')}
                            />
                        )}
                    </AnimatePresence>

                    {error && <div className="error-box" role="alert">{error}</div>}

                    {view === 'confess' && (
                        <Cemetery
                            graves={graves}
                            onSelect={(g) => {
                                setCurrentGrave(g)
                                setView('funeral')
                                window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            onDelete={handleDelete}
                        />
                    )}
                </main>

                <footer className="footer">
                    <p>
                        <span className="footer-skull" aria-hidden="true">💀</span> {t('title')} &copy; {new Date().getFullYear()}
                    </p>
                </footer>
            </div>
        </I18nContext.Provider>
    )
}
