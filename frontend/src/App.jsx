import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ====================================================
// 💀 Session Management
// ====================================================

function getSessionId() {
    let id = localStorage.getItem('funeral-session-id')
    if (!id) {
        id = (self.crypto?.randomUUID?.() ?? Date.now().toString())
        localStorage.setItem('funeral-session-id', id)
    }
    return id
}

const SESSION_ID = getSessionId()

// Same origin by default: nginx (and the Vite dev proxy) route /api to the backend.
// Set VITE_API_URL only when the API lives on another host.
const API_URL = import.meta.env.VITE_API_URL || ''

// --- FRONTEND-ONLY FALLBACK DATA ---
const EPITAPHS = {
    ru: [
        (m) => `Здесь покоится «${m}» — решение настолько дерзкое, что даже Дарвин аплодировал.`,
        (m) => `Светлая память «${m}». В 3 часа ночи это казалось гениальной идеей.`,
        (m) => `Покойся с миром, «${m}». Ты научило нас, как НЕ надо делать.`,
        (m) => `Любимое «${m}» — рождённое в самоуверенности, умершее от здравого смысла.`,
    ],
    en: [
        (m) => `Here lies "${m}" — a decision so bold, even Darwin applauded.`,
        (m) => `In loving memory of "${m}". It seemed brilliant at 3am.`,
        (m) => `Rest in peace, "${m}". You taught us all what NOT to do.`,
        (m) => `Beloved "${m}" — born in overconfidence, died in hindsight.`,
    ],
}

const EULOGIES = {
    ru: [
        (m) => `Дорогие скорбящие, мы собрались здесь, чтобы проводить «${m}» в последний путь. Оно ворвалось в нашу жизнь как товарный поезд плохих решений и ушло так же — громко, с дымом и оставив всех в недоумении. Пусть покоится в вечном кринже.`,
        (m) => `Сегодня мы провожаем «${m}» — решение, которое шло, чтобы наша мудрость могла бежать. Оно появилось в момент слабости и задержалось ровно настолько, чтобы вызвать максимальный стыд. Спасибо за службу.`,
    ],
    en: [
        (m) => `Dearly departed, we gather here today to bid farewell to "${m}". It arrived in our lives like a freight train of bad judgment, and it left the same way — loudly, with smoke, and leaving everyone confused. May it rest in eternal cringe.`,
        (m) => `We come together to mourn "${m}" — a decision that walked so our wisdom could run. It appeared during a moment of weakness and stayed just long enough to cause maximum embarrassment. Thank you for your service.`,
    ],
}

const CAUSES_OF_DEATH = {
    ru: ["Терминальное перемудривание", "Острая нехватка здравого смысла", "Смерть от проверки реальностью"],
    en: ["Terminal overthinking", "Acute lack of common sense", "Death by reality check"],
}

function detectLanguage(text) {
    const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) || []).length
    const latinCount = (text.match(/[a-zA-Z]/g) || []).length
    return cyrillicCount > latinCount ? 'ru' : 'en'
}

function localBury(mistake) {
    const lang = detectLanguage(mistake)
    const now = new Date()
    const diedRu = `${now.getDate()} ${['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'][now.getMonth()]} ${now.getFullYear()}`
    const diedEn = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)]

    const grave = {
        id: 'local-' + Math.random().toString(36).substr(2, 9),
        mistake,
        born: lang === 'ru' ? '2025' : '2025',
        died: lang === 'ru' ? diedRu : diedEn,
        epitaph: randomFrom(EPITAPHS[lang])(mistake),
        eulogy: randomFrom(EULOGIES[lang])(mistake),
        causeOfDeath: randomFrom(CAUSES_OF_DEATH[lang]),
        buriedAt: now.toISOString(),
        isLocal: true
    }

    const existing = JSON.parse(localStorage.getItem('funeral-local-graves') || '[]')
    localStorage.setItem('funeral-local-graves', JSON.stringify([grave, ...existing]))
    return grave
}

function getLocalGraves() {
    return JSON.parse(localStorage.getItem('funeral-local-graves') || '[]')
}

function deleteLocalGrave(id) {
    const existing = JSON.parse(localStorage.getItem('funeral-local-graves') || '[]')
    localStorage.setItem('funeral-local-graves', JSON.stringify(existing.filter(g => g.id !== id)))
}

async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Session-Id': SESSION_ID,
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
        throw new Error(err.error || 'Что-то пошло не так в склепе...')
    }
    return res.json()
}

// ====================================================
// 💀 Loading Messages
// ====================================================

const LOADING_MESSAGES = [
    "Копаем могилу...",
    "Полируем надгробие...",
    "Пишем эпитафию кровью...",
    "Зажигаем свечи...",
    "Собираем скорбящих...",
    "Готовим панихиду...",
    "Вызываем священника...",
    "Заказываем гроб премиум-класса...",
    "Призываем духов...",
    "Освящаем землю...",
]

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

function AmbientHorror({ isMuted }) {
    const audioContextRef = useRef(null);
    const nodesRef = useRef([]);

    const startAudio = useCallback(() => {
        if (audioContextRef.current) return;

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = ctx;

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(isMuted ? 0.0001 : 0.4, ctx.currentTime);
            masterGain.connect(ctx.destination);

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
                if (isMuted) return;
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
            const beatInterval = setInterval(() => {
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

            nodesRef.current = [masterGain, beatInterval];
        } catch (e) {
            console.warn("Horror Audio Pipeline failed", e);
        }
    }, [isMuted]);

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
        if (nodesRef.current.length > 0) {
            const now = audioContextRef.current.currentTime;
            nodesRef.current[0].gain.exponentialRampToValueAtTime(isMuted ? 0.0001 : 0.4, now + 1.0);
        }
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
// 💀 Header
// ====================================================

function Header({ isMuted, onToggleMute }) {
    return (
        <header className="header">
            <div className="header-top">

                <div className="header-skull">💀</div>
            </div>
            <h1>Funeral for Stupid Decisions</h1>
            <p>Исповедай своё худшее решение. Мы устроим ему достойные похороны.</p>
        </header>
    )
}

// ====================================================
// 💀 Confessional Input
// ====================================================

function Confessional({ onSubmit, isLoading }) {
    const [mistake, setMistake] = useState('')
    const [ripple, setRipple] = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!mistake.trim() || isLoading) return
        // Trigger stone button ripple/shake
        setRipple(true)
        setTimeout(() => setRipple(false), 400)
        // Play burial sound via Web Audio API
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
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
        onSubmit(mistake.trim())
        setMistake('')
    }

    return (
        <motion.div
            className="confessional"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
        >
            <form className="confessional-box" onSubmit={handleSubmit}>
                <label className="confessional-label">
                    <span>🕯️</span> Исповедай свой грех...
                </label>
                <textarea
                    className="confessional-textarea"
                    placeholder="I spent all time building this… for absolutely u 😌"                    value={mistake}
                    onChange={(e) => setMistake(e.target.value)}
                    maxLength={500}
                    disabled={isLoading}
                />
                <div className="textarea-footer">
                    <span className="char-count">{mistake.length}/500</span>
                    <span className="lang-hint">
                        {mistake.length > 3 && (
                            /[\u0400-\u04FF]/.test(mistake) ? '🇷🇺 Русский' : '🇬🇧 English'
                        )}
                    </span>
                </div>
                <button
                    type="submit"
                    className={`bury-btn${ripple ? ' bury-btn--strike' : ''}`}
                    disabled={!mistake.trim() || isLoading}
                >
                    <span className="btn-skull">💀</span>
                    <span className="btn-text">Start</span>
                    <span className="btn-skull">💀</span>
                </button>
            </form>
        </motion.div>
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
    const [msgIndex, setMsgIndex] = useState(0)
    const [phase, setPhase] = useState(0) // 0=digging, 1=coffin lowering

    useEffect(() => {
        const msgInterval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
        }, 1800)
        const phaseInterval = setInterval(() => {
            setPhase(p => (p + 1) % 3)
        }, 2400)
        return () => {
            clearInterval(msgInterval)
            clearInterval(phaseInterval)
        }
    }, [])

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
                {LOADING_MESSAGES[msgIndex]}
            </motion.p>

            <div className="loading-dots">
                <span /><span /><span />
            </div>
        </motion.div>
    )
}

// ====================================================
// 💀 Scroll Modal — Full Funeral Speech
// ====================================================

function ScrollModal({ eulogy, onClose }) {
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
                        <div className="scroll-icon">📜</div>
                        <h3 className="scroll-title">Официальная Панихида</h3>
                        <div className="scroll-divider">✦ ✦ ✦</div>
                    </div>

                    <p className="scroll-text">{eulogy}</p>

                    <div className="scroll-footer">
                        <div className="scroll-seal">⚰️</div>
                        <p className="scroll-signed">— Бюро Достойных Похорон, {new Date().getFullYear()}</p>
                    </div>
                </div>

                {/* Scroll bottom curl */}
                <div className="scroll-curl scroll-curl-bottom">
                    <div className="scroll-curl-line" />
                </div>

                <button className="scroll-close" onClick={onClose} title="Закрыть (ESC)">
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
    const [showScroll, setShowScroll] = useState(false)

    return (
        <>
            <AnimatePresence>
                {showScroll && (
                    <ScrollModal
                        eulogy={data.eulogy}
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
                    initial={{ rotateX: 30 }}
                    animate={{ rotateX: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    onClick={() => setShowScroll(true)}
                    title="Нажми, чтобы прочитать панихиду 📜"
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {/* Click hint */}
                    <div className="tombstone-click-hint">
                        <span>📜</span> нажми для панихиды
                    </div>

                    <h2 className="grave-rip">Покойся с Миром</h2>
                    <div className="grave-mistake">{data.mistake}</div>
                    <div className="grave-dates">{data.born} — {data.died}</div>
                    <p className="grave-epitaph">{data.epitaph}</p>
                    {data.causeOfDeath && (
                        <div className="grave-cause">
                            <span>⚕️</span> Причина смерти: {data.causeOfDeath}
                        </div>
                    )}
                </motion.div>

                {/* Ground mound */}
                <div className="grave-mound" />

                {/* Candles */}
                <div className="grave-candles">
                    <div className="grave-candle">🕯️</div>
                    <div className="grave-candle" style={{ animationDelay: '0.7s' }}>🕯️</div>
                    <div className="grave-candle" style={{ animationDelay: '1.3s' }}>🕯️</div>
                </div>

                <motion.div
                    className="grave-actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    <button className="action-btn" onClick={() => setShowScroll(true)}>
                        <span className="btn-skull">📜</span>
                        <span className="btn-text">Читать панихиду</span>
                        <span className="btn-skull">📜</span>
                    </button>
                    <button className="action-btn" onClick={onBuryAnother}>
                        <span className="btn-skull">⚰️</span>
                        <span className="btn-text">Похоронить ещё</span>
                        <span className="btn-skull">⚰️</span>
                    </button>
                </motion.div>
            </motion.div>
        </>
    )
}

// ====================================================
// 💀 Cemetery — Grave History
// ====================================================

function Cemetery({ graves, onSelect, onDelete }) {
    if (graves.length === 0) return null

    return (
        <motion.section
            className="cemetery-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
        >
            <h2 className="cemetery-title">🪦 Моё Кладбище</h2>
            <p className="cemetery-subtitle">Нажми на могилу, чтобы перечитать панихиду</p>
            <div className="cemetery-grid">
                {graves.map((grave, i) => (
                    <motion.div
                        key={grave.id || i}
                        className="mini-grave"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        whileHover={{ scale: 1.04, y: -4 }}
                        layout
                    >
                        <div className="mini-grave-content" onClick={() => onSelect(grave)}>
                            <div className="mini-grave-icon">🪦</div>
                            <div className="mini-grave-name">{grave.mistake}</div>
                            <div className="mini-grave-date">{grave.died}</div>
                        </div>
                        <button
                            className="mini-grave-delete"
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(grave.id)
                            }}
                            title="Удалить могилу навсегда"
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
    const [view, setView] = useState('confess') // 'confess' | 'loading' | 'funeral'
    const [currentGrave, setCurrentGrave] = useState(null)
    const [graves, setGraves] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [isMuted, setIsMuted] = useState(false)

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
                body: JSON.stringify({ mistake }),
            })
            setCurrentGrave(data)
            setView('funeral')
            loadGraves()
        } catch (err) {
            setError(err.message || 'Что-то пошло ужасно не так в склепе.')
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
        <div className="app-container">
            <AmbientHorror isMuted={isMuted} />
            <ScreenOverlays />
            <SpiderWebs />
            <Particles />

            <main className="main-content">
                <Header isMuted={isMuted} onToggleMute={() => setIsMuted(!isMuted)} />

                <AnimatePresence mode="wait">
                    {view === 'confess' && (
                        <Confessional key="confess" onSubmit={handleBury} isLoading={loading} />
                    )}
                    {view === 'loading' && (
                        <DiggingScene key="loading" />
                    )}
                    {view === 'funeral' && currentGrave && (
                        <Gravestone
                            key="funeral"
                            data={currentGrave}
                            onBuryAnother={() => setView('confess')}
                        />
                    )}
                </AnimatePresence>

                {error && <div className="error-box">{error}</div>}

                {view === 'confess' && (
                    <Cemetery
                        graves={graves}
                        onSelect={(g) => {
                            setCurrentGrave(g)
                            setView('funeral')
                        }}
                        onDelete={handleDelete}
                    />
                )}
            </main>

            <footer className="footer">
                <p>
                    <span className="footer-skull">💀</span> Funeral for Stupid Decisions &copy; 2026
                </p>
            </footer>
        </div>
    )
}
