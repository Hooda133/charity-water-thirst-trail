"use strict";
/*
 * Thirst Trail — action-only sound design.
 * Original short synthesised cues; no samples, downloads, music or looping audio.
 * The AudioContext is created lazily after a player action. Audio is optional:
 * browsers without Web Audio, suspended devices and blocked storage stay playable.
 */
(() => {
  const ENABLED_KEY = "thirstTrailSound"; // Keep the original setting exactly.
  const VOLUME_KEY = "thirstTrailSfxVolume";
  const DEFAULT_VOLUME = 0.55;
  const MIN_INTERVAL_MS = 55;
  const MAX_VOICES = 12;

  const clamp = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : fallback;
  };
  function readSetting(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  function writeSetting(key, value) {
    try { window.localStorage.setItem(key, value); } catch { /* Private mode. */ }
  }
  let enabled = readSetting(ENABLED_KEY) !== "false";
  let volume = clamp(readSetting(VOLUME_KEY) ?? DEFAULT_VOLUME, DEFAULT_VOLUME);
  let context = null;
  let master = null;
  let activeVoices = 0;
  const lastCue = new Map();

  // Each note: frequency Hz, start offset seconds, duration seconds,
  // oscillator shape, relative loudness, down-sweep ratio.
  // Quiet, non-overlapping bursts make repeated puzzle interactions comfortable.
  const cues = Object.freeze({
    tap:       [[510,0,.045,"sine",.40,.96]],
    interact:  [[520,0,.075,"triangle",.45,1.08]],
    collect:   [[740,0,.085,"sine",.68,1.23],[1050,.075,.12,"triangle",.48,1.08]],
    reward:    [[655,0,.10,"triangle",.55,1.18],[875,.095,.12,"sine",.54,1.10]],
    confirm:   [[680,0,.07,"sine",.43,1.12]],
    mistake:   [[260,0,.115,"triangle",.62,.65],[185,.090,.12,"sine",.36,.72]],
    warning:   [[335,0,.095,"triangle",.46,.80]],
    repair:    [[405,0,.055,"triangle",.49,1.12],[615,.045,.10,"sine",.43,1.17],[825,.14,.10,"triangle",.39,1.10]],
    water:     [[490,0,.11,"sine",.55,1.35],[670,.085,.14,"sine",.42,.89]],
    deliver:   [[570,0,.085,"triangle",.52,1.2],[785,.095,.12,"sine",.48,1.12]],
    build:     [[420,0,.09,"triangle",.52,1.12],[625,.075,.115,"triangle",.47,1.08],[880,.17,.16,"sine",.54,1.08]],
    victory:   [[523,0,.15,"triangle",.63,1.03],[659,.14,.16,"sine",.58,1.03],
                [784,.28,.18,"triangle",.59,1.04],[1047,.43,.29,"sine",.72,1.01]],
    failure:   [[290,0,.14,"triangle",.53,.78],[205,.115,.2,"sine",.40,.83]],
    preview:   [[690,0,.075,"sine",.42,1.18],[890,.07,.11,"triangle",.41,1.05]]
  });

  function getContext() {
    if(context) return context;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if(!Audio) return null;
    try {
      context = new Audio();
      master = context.createGain();
      master.gain.value = volume;
      master.connect(context.destination);
      return context;
    } catch {
      context = null;
      master = null;
      return null;
    }
  }
  function ready() {
    const audio = getContext();
    if(!audio || audio.state === "closed") return null;
    if(audio.state === "suspended") {
      try {
        const resume = audio.resume();
        if(resume && typeof resume.catch === "function") resume.catch(() => {});
      } catch { /* Muted by browser autoplay policy. */ }
    }
    return audio;
  }
  function note(audio, data, start) {
    if(activeVoices >= MAX_VOICES) return;
    const [frequency, offset, duration, shape, loudness, sweep] = data;
    const begin = start + offset;
    const end = begin + duration;
    let oscillator, envelope;
    try {
      oscillator = audio.createOscillator();
      envelope = audio.createGain();
      oscillator.type = shape;
      oscillator.frequency.setValueAtTime(frequency, begin);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(100, frequency * sweep), end);
      envelope.gain.setValueAtTime(.0001, begin);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, loudness * .065), begin + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, end);
      oscillator.connect(envelope);
      envelope.connect(master);
      activeVoices++;
      let cleaned = false;
      const cleanup = () => {
        if(cleaned) return;
        cleaned = true;
        activeVoices = Math.max(0, activeVoices - 1);
        try { oscillator.disconnect(); envelope.disconnect(); } catch {}
      };
      oscillator.onended = cleanup;
      oscillator.start(begin);
      oscillator.stop(end + .005);
    } catch {
      try { oscillator?.disconnect(); envelope?.disconnect(); } catch {}
    }
  }
  function play(name) {
    if(!enabled || volume <= 0 || !Object.prototype.hasOwnProperty.call(cues,name)) return false;
    const now = typeof performance === "object" && typeof performance.now === "function"
      ? performance.now() : Date.now();
    const previous = lastCue.get(name);
    if(previous !== undefined && now - previous < MIN_INTERVAL_MS) return false;
    const audio = ready();
    if(!audio || !master) return false;
    lastCue.set(name,now);
    const start=audio.currentTime + .008;
    for(const data of cues[name]) note(audio,data,start);
    return true;
  }
  // Compatibility for legacy tap feedback. Uses the same volume, mute and
  // lightweight envelope as the named sound palette, without looping.
  function tone(frequency=540,duration=.065) {
    if(!enabled || volume <= 0) return false;
    const audio=ready();
    if(!audio || !master) return false;
    note(audio,[
      Math.max(120,Math.min(1800,Number(frequency)||540)),0,
      Math.max(.035,Math.min(.18,Number(duration)||.065)),"sine",.37,1.02
    ], audio.currentTime+.008);
    return true;
  }
  function setEnabled(next) {
    enabled=!!next;
    writeSetting(ENABLED_KEY,String(enabled));
    // An existing note can finish gracefully, but its output is muted at once.
    if(master && context && context.state!=="closed") {
      master.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.008);
    }
    return enabled;
  }
  function setVolume(next) {
    volume=clamp(next,volume);
    writeSetting(VOLUME_KEY,String(volume));
    if(master && context && context.state!=="closed") {
      master.gain.setTargetAtTime(enabled?volume:0,context.currentTime,.008);
    }
    return volume;
  }
  function dispose() {
    lastCue.clear();
    if(context) {
      try { const closing=context.close(); closing?.catch?.(() => {}); } catch {}
      context=null;master=null;
    }
  }
  window.TrailAudioEngine=Object.freeze({
    play,tone,setEnabled,setVolume,dispose,
    get enabled(){return enabled;},
    get volume(){return volume;},
    status:()=>({enabled,volume,initialized:!!context,activeVoices,
      backgroundMusic:false,ambientLoops:false})
  });
})();
