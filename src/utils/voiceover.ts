/**
 * Shared calm, gentle woman's voiceover engine for WELLBE+.
 *
 * Primary path: Server-side Gemini TTS (/api/tts using gemini-3.8-flash-lite-tts
 * with the "Kore" calm female voice + warm, soothing style metadata) with client-side
 * audio Blob caching for instant zero-latency replay of breathing & grounding cues.
 *
 * Fallback path: Browser Web Speech API with strict female-voice ranking and male-voice
 * exclusion so no feature ever falls back to a default deep/male system voice.
 */

export type VoiceProfile = 'default' | 'sanctuary';

interface SpeakOptions {
  profile?: VoiceProfile;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

const CLIENT_AUDIO_CACHE = new Map<string, string>();
const IN_FLIGHT_FETCHES = new Map<string, Promise<string | null>>();
const CLIENT_CACHE_MAX = 40;

let activeToken = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeAudioFadeRaf: number | null = null;
let activeAudioResolve: ((played: boolean) => void) | null = null;
let activeFetchAbort: AbortController | null = null;

/** Ranked preferred calm/gentle female English voices across macOS, iOS, Windows, Android & Chrome */
const PREFERRED_FEMALE_VOICE_PATTERNS: RegExp[] = [
  /google\s+uk\s+english\s+female/i,
  /microsoft\s+aria/i,
  /microsoft\s+jenny/i,
  /microsoft\s+sonia/i,
  /microsoft\s+libby/i,
  /microsoft\s+ava/i,
  /microsoft\s+emma/i,
  /microsoft\s+zira/i,
  /\bsamantha\b/i,
  /\bava\b/i,
  /\ballison\b/i,
  /\bserena\b/i,
  /\bkaren\b/i,
  /\bmoira\b/i,
  /\btessa\b/i,
  /\bvictoria\b/i,
  /\bsusan\b/i,
  /\bfiona\b/i,
  /\bmartha\b/i,
  /\bshelley\b/i,
  /\bsandy\b/i,
  /\bkathy\b/i,
  /\bveena\b/i,
  /\bflo\b/i,
  /\bstephanie\b/i,
  /\bnatalie\b/i,
  /\bclaire\b/i,
  /\bemma\b/i,
  /\bolivia\b/i,
  /\bamy\b/i,
  /\bjoanna\b/i,
  /\bsalli\b/i,
  /google\s+us\s+english/i,
  /female|woman/i,
];

/** Known male voice names to strictly avoid when selecting a browser fallback voice */
const MALE_VOICE_PATTERN =
  /\b(male|man|david|mark|george|daniel|alex|fred|guy|ryan|christopher|eric|matthew|tom|aaron|arthur|albert|bruce|ralph|reed|rocko|eddy|grandpa|junior|oliver|james|ryan|brian|joey|justin|russell|liam|william|thomas|rishi|gordon|lee|malcolm|martin|nicky|stefan|richard|sean)\b/i;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binaryStr = window.atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
  return URL.createObjectURL(blob);
}

function storeCachedUrl(key: string, url: string) {
  if (CLIENT_AUDIO_CACHE.has(key)) {
    CLIENT_AUDIO_CACHE.delete(key);
  } else if (CLIENT_AUDIO_CACHE.size >= CLIENT_CACHE_MAX) {
    const oldest = CLIENT_AUDIO_CACHE.entries().next().value;
    if (oldest) {
      const [oldKey, oldUrl] = oldest;
      CLIENT_AUDIO_CACHE.delete(oldKey);
      if (activeAudio?.src !== oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
    }
  }
  CLIENT_AUDIO_CACHE.set(key, url);
}

async function fetchStudioVoiceUrl(
  rawText: string,
  profile: VoiceProfile = 'default',
  signal?: AbortSignal
): Promise<string | null> {
  const key = normalizeText(rawText);
  if (!key) return null;
  const cacheKey = `${profile}::${key}`;

  const cached = CLIENT_AUDIO_CACHE.get(cacheKey);
  if (cached) {
    // Refresh LRU order
    CLIENT_AUDIO_CACHE.delete(cacheKey);
    CLIENT_AUDIO_CACHE.set(cacheKey, cached);
    return cached;
  }

  const existing = IN_FLIGHT_FETCHES.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ text: key, profile }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
      if (!data?.audioBase64) return null;
      const url = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
      storeCachedUrl(cacheKey, url);
      return url;
    } catch {
      return null;
    } finally {
      IN_FLIGHT_FETCHES.delete(cacheKey);
    }
  })();

  IN_FLIGHT_FETCHES.set(cacheKey, promise);
  return promise;
}

/** Pre-warm a grounding or breathing cue clip in the background for instant playback */
export function prefetchCalmFemaleVoice(
  text: string,
  profile: VoiceProfile = 'default'
): void {
  const key = normalizeText(text);
  const cacheKey = `${profile}::${key}`;
  if (!key || CLIENT_AUDIO_CACHE.has(cacheKey) || IN_FLIGHT_FETCHES.has(cacheKey)) return;
  void fetchStudioVoiceUrl(key, profile);
}

function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    const onVoicesChanged = () => finish();
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    window.setTimeout(finish, 350);
  });
}

function pickCalmFemaleBrowserVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const englishVoices = voices.filter((v) => /^en\b/i.test(v.lang));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  // 1. Check ranked calm female voice patterns first
  for (const pattern of PREFERRED_FEMALE_VOICE_PATTERNS) {
    const match = pool.find(
      (v) => pattern.test(v.name) && !MALE_VOICE_PATTERN.test(v.name)
    );
    if (match) return match;
  }

  // 2. Otherwise pick any non-male natural/local English voice
  const nonMale = pool.filter((v) => !MALE_VOICE_PATTERN.test(v.name));
  if (nonMale.length > 0) {
    const natural = nonMale.find((v) => /natural|neural|enhanced|premium/i.test(v.name));
    return natural ?? nonMale[0];
  }

  return pool[0] ?? null;
}

/** Immediately stop any active voiceover playback (studio audio or Web Speech) */
export function stopCalmVoice(): void {
  activeToken += 1;

  if (activeFetchAbort) {
    activeFetchAbort.abort();
    activeFetchAbort = null;
  }

  if (activeAudioFadeRaf !== null) {
    window.cancelAnimationFrame(activeAudioFadeRaf);
    activeAudioFadeRaf = null;
  }

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio.onplay = null;
    } catch {
      // Ignore media pause errors
    }
    activeAudio = null;
  }

  if (activeAudioResolve) {
    const settle = activeAudioResolve;
    activeAudioResolve = null;
    settle(false);
  }

  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // Ignore browser speech synthesis cancellation errors
  }
}

/**
 * Speak text using a calm, gentle woman's voice.
 * Uses server-side Gemini TTS (Kore calm female voice) with automatic fallback
 * to a curated female Web Speech voice if offline or audio playback is blocked.
 */
export async function speakCalmFemaleVoice(
  rawText: string,
  options: SpeakOptions = {}
): Promise<void> {
  const text = normalizeText(rawText);
  if (!text) {
    options.onEnd?.();
    return;
  }

  const profile: VoiceProfile = options.profile ?? 'default';

  stopCalmVoice();
  const myToken = activeToken;
  const controller = new AbortController();
  activeFetchAbort = controller;

  const audioUrl = await fetchStudioVoiceUrl(text, profile, controller.signal);
  if (myToken !== activeToken) return;
  if (activeFetchAbort === controller) {
    activeFetchAbort = null;
  }

  if (audioUrl) {
    const played = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (activeAudioFadeRaf !== null) {
          window.cancelAnimationFrame(activeAudioFadeRaf);
          activeAudioFadeRaf = null;
        }
        if (activeAudioResolve === finish) activeAudioResolve = null;
        resolve(ok);
      };
      activeAudioResolve = finish;

      try {
        const audio = new Audio(audioUrl);
        const targetVolume = profile === 'sanctuary' ? 0.85 : 0.92;
        audio.volume = profile === 'sanctuary' ? 0.02 : targetVolume;
        activeAudio = audio;

        audio.onplay = () => {
          if (myToken !== activeToken) return;
          options.onStart?.();
          if (profile === 'sanctuary') {
            const fadeStart = performance.now();
            const fadeMs = 180;
            const stepFade = (now: number) => {
              if (myToken !== activeToken || activeAudio !== audio) {
                activeAudioFadeRaf = null;
                return;
              }
              const progress = Math.min(1, (now - fadeStart) / fadeMs);
              audio.volume = Math.min(targetVolume, 0.02 + (targetVolume - 0.02) * progress);
              if (progress < 1) {
                activeAudioFadeRaf = window.requestAnimationFrame(stepFade);
              } else {
                activeAudioFadeRaf = null;
              }
            };
            activeAudioFadeRaf = window.requestAnimationFrame(stepFade);
          }
        };
        audio.onended = () => {
          if (activeAudio === audio) activeAudio = null;
          if (myToken === activeToken) options.onEnd?.();
          finish(true);
        };
        audio.onerror = () => {
          if (activeAudio === audio) activeAudio = null;
          finish(false);
        };

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            if (activeAudio === audio) activeAudio = null;
            finish(false);
          });
        }
      } catch {
        finish(false);
      }
    });

    if (played || myToken !== activeToken) return;
  }

  // Fallback: Browser Web Speech API explicitly targeting a calm female voice
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (myToken === activeToken) {
      options.onError?.(
        'Voice guidance is unavailable in this browser; follow the text cues below.'
      );
    }
    return;
  }

  const voices = await getAvailableVoices();
  if (myToken !== activeToken) return;

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const femaleVoice = pickCalmFemaleBrowserVoice(voices);
    if (femaleVoice) {
      utter.voice = femaleVoice;
      utter.lang = femaleVoice.lang || 'en-US';
    } else {
      utter.lang = 'en-US';
    }
    // Gentle, unhurried feminine cadence (extra soft and unhurried for Voice Panic Anchor)
    utter.rate = profile === 'sanctuary' ? 0.8 : 0.86;
    utter.pitch = profile === 'sanctuary' ? 1.02 : 1.06;
    utter.volume = profile === 'sanctuary' ? 0.84 : 0.92;

    utter.onstart = () => {
      if (myToken === activeToken) options.onStart?.();
    };
    utter.onend = () => {
      if (myToken === activeToken) options.onEnd?.();
    };
    utter.onerror = (ev) => {
      if (myToken !== activeToken) return;
      if (ev.error === 'canceled' || ev.error === 'interrupted') return;
      options.onError?.('Audio output blocked or unavailable. Follow visual pacing.');
    };

    window.speechSynthesis.speak(utter);
  } catch {
    if (myToken === activeToken) {
      options.onError?.('Audio output unavailable. Follow visual pacing.');
    }
  }
}
