// ====================================================
// 🎙️ Microphone → 16 kHz mono WAV
// ====================================================
//
// MediaRecorder gives webm/opus (Chrome) or mp4 (Safari), and Gemini does not
// reliably accept webm. Recording raw samples and writing the WAV ourselves works
// the same on every phone and needs no transcoding on the server.

const TARGET_RATE = 16000
const MIN_SECONDS = 0.7

export function micSupported() {
    return !!(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext))
}

/**
 * Starts recording. Resolves once the microphone is open, with
 * { stop(), elapsed(), done } — `done` resolves to a WAV Blob, or null when the
 * recording was too short to hold a sentence.
 */
export async function startRecording({ maxSeconds = 30 } = {}) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    await ctx.resume()

    const source = ctx.createMediaStreamSource(stream)
    // ScriptProcessor is deprecated but, unlike AudioWorklet, needs no extra module
    // file and runs on every mobile browser still in use.
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const chunks = []
    processor.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
    source.connect(processor)
    processor.connect(ctx.destination) // Chrome only fires onaudioprocess when connected; the output stays silent

    const started = performance.now()
    let finish
    const done = new Promise((resolve) => { finish = resolve })
    let stopped = false

    const stop = async () => {
        if (stopped) return
        stopped = true
        clearTimeout(timer)
        processor.disconnect()
        source.disconnect()
        stream.getTracks().forEach((t) => t.stop())
        const rate = ctx.sampleRate
        await ctx.close().catch(() => {})
        const samples = merge(chunks)
        if (samples.length < rate * MIN_SECONDS) return finish(null)
        finish(encodeWav(downsample(samples, rate, TARGET_RATE), TARGET_RATE))
    }
    const timer = setTimeout(stop, maxSeconds * 1000)

    return { stop, done, elapsed: () => (performance.now() - started) / 1000 }
}

function merge(chunks) {
    const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0))
    let offset = 0
    for (const c of chunks) { out.set(c, offset); offset += c.length }
    return out
}

// Box-filter decimation: averages the samples that fall into each output slot, which
// is enough anti-aliasing for speech at 16 kHz.
function downsample(input, fromRate, toRate) {
    if (fromRate === toRate) return input
    const ratio = fromRate / toRate
    const out = new Float32Array(Math.floor(input.length / ratio))
    for (let i = 0; i < out.length; i++) {
        const start = Math.floor(i * ratio)
        const end = Math.min(input.length, Math.floor((i + 1) * ratio))
        let sum = 0
        for (let j = start; j < end; j++) sum += input[j]
        out[i] = sum / Math.max(1, end - start)
    }
    return out
}

function encodeWav(samples, rate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const text = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)) }
    text(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    text(8, 'WAVE')
    text(12, 'fmt ')
    view.setUint32(16, 16, true) // PCM chunk size
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // mono
    view.setUint32(24, rate, true)
    view.setUint32(28, rate * 2, true) // byte rate
    view.setUint16(32, 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample
    text(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return new Blob([buffer], { type: 'audio/wav' })
}
