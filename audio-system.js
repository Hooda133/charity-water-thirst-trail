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
  const STYLE_KEY = "thirstTrailSfxStyle";
  const DEFAULT_VOLUME = 0.55;
  const MAX_VOICES = 9;

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
  // New installs and existing players both start with the calmer sound design.
  // Previous volume and mute settings stay untouched.
  const validStyles = new Set(["soft","minimal","classic"]);
  const normalizeStyle = value => validStyles.has(value) ? value : "soft";
  let style = normalizeStyle(readSetting(STYLE_KEY));
  let context = null;
  let master = null;
  let activeVoices = 0;
  const lastCue = new Map();

  // Each note: frequency Hz, start offset seconds, duration seconds,
  // oscillator shape, relative loudness, down-sweep ratio.
  // Quiet, non-overlapping bursts make repeated puzzle interactions comfortable.

  // Soft: rounded tactile taps, lower wet-sounding drops, quiet wooden repairs.
  // Single-note feedback replaces the high-pitched arcade melodies; the
  // understated success phrase is the only longer sequence.
  const softCues = Object.freeze({
    tap:      [[325,0,.052,"sine",.31,.79]],
    interact: [[365,0,.070,"sine",.35,.81]],
    collect:  [[475,0,.105,"sine",.47,.57],[285,.055,.082,"sine",.20,.90]],
    reward:   [[385,0,.085,"triangle",.35,.94],[475,.065,.090,"sine",.25,.96]],
    confirm:  [[395,0,.065,"sine",.29,.94]],
    mistake:  [[215,0,.115,"sine",.36,.70]],
    warning:  [[235,0,.086,"sine",.30,.73]],
    repair:   [[260,0,.072,"triangle",.36,.68],[345,.064,.095,"sine",.26,.94]],
    water:    [[455,0,.130,"sine",.42,.54],[275,.085,.096,"sine",.25,.78]],
    deliver:  [[350,0,.095,"sine",.36,.83],[420,.070,.105,"sine",.26,.98]],
    build:    [[250,0,.081,"triangle",.35,.77],[355,.071,.10,"sine",.28,.91]],
    victory:  [[392,0,.14,"sine",.35,.98],[494,.12,.16,"sine",.32,.99],[587,.26,.20,"sine",.36,.98]],
    failure:  [[235,0,.145,"sine",.30,.70]],
    preview:  [[455,0,.12,"sine",.36,.57],[285,.075,.082,"sine",.21,.90]]
  });

  // Minimal: a nearly silent, short tactile tick, with no melodic fanfare.
  const minimalCues = Object.freeze({
    tap:      [[270,0,.035,"sine",.19,.82]],
    interact: [[300,0,.045,"sine",.21,.83]],
    collect:  [[400,0,.065,"sine",.25,.75]],
    reward:   [[345,0,.060,"sine",.24,.88]],
    confirm:  [[320,0,.042,"sine",.21,.95]],
    mistake:  [[180,0,.080,"sine",.22,.75]],
    warning:  [[190,0,.075,"sine",.20,.79]],
    repair:   [[260,0,.061,"sine",.23,.72]],
    water:    [[395,0,.080,"sine",.27,.66]],
    deliver:  [[325,0,.068,"sine",.23,.81]],
    build:    [[275,0,.068,"sine",.23,.85]],
    victory:  [[375,0,.085,"sine",.25,.98],[465,.080,.10,"sine",.23,.98]],
    failure:  [[185,0,.095,"sine",.23,.72]],
    preview:  [[390,0,.065,"sine",.22,.76],[290,.060,.056,"sine",.15,.88]]
  });

  // Classic retains the previous recognisable note patterns for players who
  // explicitly prefer them. Existing players are not forced to keep this style.
  const classicCues = Object.freeze({
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
  const cueBanks=Object.freeze({soft:softCues,minimal:minimalCues,classic:classicCues});


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
    let oscillator, envelope, filter;
    try {
      oscillator = audio.createOscillator();
      envelope = audio.createGain();
      oscillator.type = shape;
      oscillator.frequency.setValueAtTime(frequency, begin);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(100, frequency * sweep), end);
      envelope.gain.setValueAtTime(.0001, begin);
      // Extra headroom and low-pass filtering keep the softer styles warm.
      const styleGain=style==="classic" ? 1 : style==="minimal" ? .52 : .72;
      envelope.gain.exponentialRampToValueAtTime(
        Math.max(.0002, loudness * .065 * styleGain), begin + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, end);
      if(style!=="classic" && typeof audio.createBiquadFilter==="function"){
        filter=audio.createBiquadFilter();
        filter.type="lowpass";
        filter.frequency.setValueAtTime(style==="minimal"?850:1250,begin);
        filter.Q.value=.55;
        oscillator.connect(filter);
        filter.connect(envelope);
      } else oscillator.connect(envelope);
      envelope.connect(master);
      activeVoices++;
      let cleaned = false;
      const cleanup = () => {
        if(cleaned) return;
        cleaned = true;
        activeVoices = Math.max(0, activeVoices - 1);
        try { oscillator.disconnect(); filter?.disconnect(); envelope.disconnect(); } catch {}
      };
      oscillator.onended = cleanup;
      oscillator.start(begin);
      oscillator.stop(end + .005);
    } catch {
      try { oscillator?.disconnect(); filter?.disconnect(); envelope?.disconnect(); } catch {}
    }
  }
  function play(name) {
    const bank=cueBanks[style];
    if(!enabled || volume <= 0 || !Object.prototype.hasOwnProperty.call(bank,name)) return false;
    const now = typeof performance === "object" && typeof performance.now === "function"
      ? performance.now() : Date.now();
    const previous = lastCue.get(name);
    const cooldown=style==="classic"?55:style==="minimal"?125:95;
    if(previous !== undefined && now - previous < cooldown) return false;
    const audio = ready();
    if(!audio || !master) return false;
    lastCue.set(name,now);
    const start=audio.currentTime + .008;
    for(const data of bank[name]) note(audio,data,start);
    return true;
  }
  // Compatibility for legacy tap feedback. Uses the same volume, mute and
  // lightweight envelope as the named sound palette, without looping.
  function tone(frequency=540,duration=.065) {
    if(!enabled || volume <= 0) return false;
    // Legacy arbitrary beeps become a single gentle click, instead of
    // retaining high-pitched electronic glides in the softer modes.
    if(style!=="classic") return play("tap");
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
  function setStyle(next) {
    if(!validStyles.has(next)) return style;
    style=next;
    writeSetting(STYLE_KEY,style);
    lastCue.clear();
    return style;
  }
  function dispose() {
    lastCue.clear();
    if(context) {
      try { const closing=context.close(); closing?.catch?.(() => {}); } catch {}
      context=null;master=null;
    }
  }
  window.TrailAudioEngine=Object.freeze({
    play,tone,setEnabled,setVolume,setStyle,dispose,
    get enabled(){return enabled;},
    get volume(){return volume;},
    get style(){return style;},
    status:()=>({enabled,volume,style,initialized:!!context,activeVoices,
      backgroundMusic:false,ambientLoops:false})
  });
})();
