// Tanjung Pelita — tiny WebAudio sound effects, all synthesized, no audio files.
// The AudioContext is created lazily on the first user gesture (browsers block sound
// before one) and every effect is a short oscillator blip, so there is nothing to load.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (muted) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }

  function blip(freq, dur, type, vol, when, slideTo) {
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // punch/shoot/enterCar/wanted are defined here for the combat and driving
  // moments, but the loop only triggers click/pickup/mission/busted today —
  // the world never calls back into audio, so these wait for a wiring pass.
  return {
    setMuted(value) { muted = !!value; },
    isMuted() { return muted; },
    unlock() { ensure(); },
    click() { blip(660, 0.06, 'square', 0.04); },
    pickup() { blip(880, 0.09, 'sine', 0.07); blip(1320, 0.12, 'sine', 0.07, 0.08); },
    punch() { blip(180, 0.1, 'sawtooth', 0.08, 0, 90); },
    shoot() { blip(1200, 0.09, 'square', 0.07, 0, 300); },
    enterCar() { blip(300, 0.08, 'triangle', 0.06); blip(420, 0.1, 'triangle', 0.06, 0.07); },
    wanted() { blip(520, 0.16, 'sawtooth', 0.06, 0, 780); blip(780, 0.16, 'sawtooth', 0.06, 0.16, 520); },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.14, 'triangle', 0.07, i * 0.09));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.2, 'sawtooth', 0.06, i * 0.14));
    },
  };
}
