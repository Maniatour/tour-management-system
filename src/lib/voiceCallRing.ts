/** 수신 통화 벨 2음 (짧은 전화 벨 느낌) — useVoiceCall·다른 탭 알림에서 공유 */
export function playIncomingRingBeep(ctx: AudioContext) {
  const t0 = ctx.currentTime
  const tone = (freq: number, start: number, dur: number) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.linearRampToValueAtTime(0.22, start + 0.025)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + dur)
  }
  tone(440, t0, 0.32)
  tone(523.25, t0 + 0.38, 0.36)
}
