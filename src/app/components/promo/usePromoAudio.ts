import { useCallback, useEffect, useRef, useState } from "react";

const MASTER_VOLUME = 0.32;
const decodedAudioCache = new Map<string, AudioBuffer>();

export const PROMO_AUDIO_ASSETS = {
  ambient: null as string | null,
  focusPulse: null as string | null,
  softWhoosh: null as string | null,
  uiTick: null as string | null,
  transitionRise: null as string | null,
  outroChime: null as string | null,
};

type PromoAudioControls = {
  audioEnabled: boolean;
  audioUnlocked: boolean;
  toggleAudio: () => void;
  restartAudio: () => void;
};

type SoundScheduler = (ctx: AudioContext, master: GainNode, at: number) => void;

export function usePromoAudio(replayToken: number, reducedMotion: boolean): PromoAudioControls {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const enabledRef = useRef(false);
  const reducedRef = useRef(reducedMotion);
  const scheduledReplayRef = useRef(replayToken);

  useEffect(() => {
    enabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const stopAudio = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== "closed") {
      void ctx.close();
    }
    ctxRef.current = null;
    masterRef.current = null;
  }, []);

  const ensureAudio = useCallback(async () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!ctxRef.current) {
      const ctx = new AudioContextCtor();
      const master = ctx.createGain();
      master.gain.value = MASTER_VOLUME;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }

    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    setAudioUnlocked(true);
    return ctx;
  }, []);

  const scheduleSound = useCallback(
    (delayMs: number, scheduler: SoundScheduler) => {
      const timer = setTimeout(() => {
        const ctx = ctxRef.current;
        const master = masterRef.current;
        if (!ctx || !master || !enabledRef.current) return;
        scheduler(ctx, master, ctx.currentTime + 0.01);
      }, delayMs);
      timersRef.current.push(timer);
    },
    [],
  );

  const startTimeline = useCallback(async () => {
    stopAudio();
    scheduledReplayRef.current = replayToken;
    const ctx = await ensureAudio();
    const master = masterRef.current;
    if (!ctx || !master) return;

    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(MASTER_VOLUME, ctx.currentTime);

    if (reducedRef.current) {
      scheduleSound(80, playOutroChime);
      return;
    }

    scheduleSound(0, playAmbientPad);
    scheduleSound(4750, playSoftWhoosh);
    scheduleSound(5650, playFocusPulse);
    scheduleSound(8450, playWideSwoosh);
    [10250, 10850, 11450].forEach((delay) => scheduleSound(delay, playUiTick));
    scheduleSound(13950, playSoftWhoosh);
    [15450, 15900, 16350].forEach((delay) => scheduleSound(delay, playUiTick));
    scheduleSound(19050, playTransitionRise);
    scheduleSound(20050, playWideSwoosh);
    scheduleSound(22650, playOutroChime);
  }, [ensureAudio, replayToken, scheduleSound, stopAudio]);

  const toggleAudio = useCallback(() => {
    if (enabledRef.current) {
      enabledRef.current = false;
      setAudioEnabled(false);
      stopAudio();
      return;
    }

    enabledRef.current = true;
    setAudioEnabled(true);
    void startTimeline();
  }, [startTimeline, stopAudio]);

  const restartAudio = useCallback(() => {
    if (!enabledRef.current) return;
    void startTimeline();
  }, [startTimeline]);

  useEffect(() => {
    if (audioEnabled && replayToken !== scheduledReplayRef.current) {
      void startTimeline();
    }
  }, [audioEnabled, replayToken, startTimeline]);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return { audioEnabled, audioUnlocked, toggleAudio, restartAudio };
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function playAmbientPad(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.ambient) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.ambient, at, 0.42);
    return;
  }

  const output = ctx.createGain();
  output.gain.setValueAtTime(0.0001, at);
  output.gain.exponentialRampToValueAtTime(0.2, at + 5.6);
  output.gain.setValueAtTime(0.18, at + 18.8);
  output.gain.exponentialRampToValueAtTime(0.0001, at + 23.4);
  output.connect(master);

  [110, 165, 220].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = index === 0 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(index === 0 ? 0.28 : 0.08, at);
    osc.connect(gain);
    gain.connect(output);
    osc.start(at);
    osc.stop(at + 23.6);
  });
}

function playFocusPulse(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.focusPulse) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.focusPulse, at, 0.45);
    return;
  }

  tone(ctx, master, {
    at,
    frequency: 294,
    endFrequency: 392,
    duration: 1.15,
    gain: 0.16,
    type: "sine",
  });
  tone(ctx, master, {
    at: at + 0.08,
    frequency: 147,
    endFrequency: 196,
    duration: 1.25,
    gain: 0.09,
    type: "triangle",
  });
}

function playSoftWhoosh(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.softWhoosh) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.softWhoosh, at, 0.34);
    return;
  }

  filteredNoise(ctx, master, at, 1.35, 0.105, 260, 2800);
  tone(ctx, master, {
    at: at + 0.05,
    frequency: 155,
    endFrequency: 260,
    duration: 1.05,
    gain: 0.045,
    type: "sine",
  });
}

function playWideSwoosh(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.softWhoosh) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.softWhoosh, at, 0.42);
    return;
  }

  filteredNoise(ctx, master, at, 1.85, 0.14, 180, 4100);
  filteredNoise(ctx, master, at + 0.26, 1.35, 0.075, 1200, 320);
  tone(ctx, master, {
    at: at + 0.12,
    frequency: 220,
    endFrequency: 392,
    duration: 1.55,
    gain: 0.055,
    type: "triangle",
  });
}

function playUiTick(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.uiTick) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.uiTick, at, 0.22);
    return;
  }

  tone(ctx, master, {
    at,
    frequency: 880,
    endFrequency: 1240,
    duration: 0.16,
    gain: 0.07,
    type: "sine",
  });
  tone(ctx, master, {
    at: at + 0.035,
    frequency: 1760,
    endFrequency: 1320,
    duration: 0.12,
    gain: 0.035,
    type: "triangle",
  });
}

function playTransitionRise(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.transitionRise) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.transitionRise, at, 0.42);
    return;
  }

  filteredNoise(ctx, master, at, 2.85, 0.16, 420, 6200);
  filteredNoise(ctx, master, at + 1.2, 1.55, 0.09, 5200, 760);
  tone(ctx, master, {
    at: at + 0.15,
    frequency: 174,
    endFrequency: 880,
    duration: 2.55,
    gain: 0.13,
    type: "sine",
  });
}

function playOutroChime(ctx: AudioContext, master: GainNode, at: number) {
  if (PROMO_AUDIO_ASSETS.outroChime) {
    void playAudioAsset(ctx, master, PROMO_AUDIO_ASSETS.outroChime, at, 0.38);
    return;
  }

  [523.25, 659.25, 880].forEach((frequency, index) => {
    tone(ctx, master, {
      at: at + index * 0.08,
      frequency,
      endFrequency: frequency,
      duration: 1.25,
      gain: 0.085 - index * 0.012,
      type: "sine",
    });
  });
}

async function playAudioAsset(
  ctx: AudioContext,
  master: GainNode,
  url: string,
  at: number,
  gainValue: number,
) {
  let buffer = decodedAudioCache.get(url);
  if (!buffer) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    buffer = await ctx.decodeAudioData(arrayBuffer);
    decodedAudioCache.set(url, buffer);
  }

  if (ctx.state === "closed") return;

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(gainValue, Math.max(ctx.currentTime, at));
  source.connect(gain);
  gain.connect(master);
  source.start(Math.max(ctx.currentTime + 0.01, at));
}

function tone(
  ctx: AudioContext,
  master: GainNode,
  options: {
    at: number;
    frequency: number;
    endFrequency: number;
    duration: number;
    gain: number;
    type: OscillatorType;
  },
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.frequency, options.at);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(options.endFrequency, 1),
    options.at + options.duration,
  );
  gain.gain.setValueAtTime(0.0001, options.at);
  gain.gain.exponentialRampToValueAtTime(options.gain, options.at + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.at + options.duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(options.at);
  osc.stop(options.at + options.duration + 0.03);
}

function filteredNoise(
  ctx: AudioContext,
  master: GainNode,
  at: number,
  duration: number,
  gainValue: number,
  startFrequency: number,
  endFrequency: number,
) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(startFrequency, at);
  filter.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  filter.Q.setValueAtTime(0.9, at);

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(gainValue, at + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(at);
  source.stop(at + duration + 0.02);
}
