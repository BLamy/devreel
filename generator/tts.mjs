// ElevenLabs TTS with character timestamps. We concatenate a lesson's per-scene
// spoken segments into one script, synthesize once, and read each segment's start
// time directly from the character alignment — exact cues, no STT. One MP3 per
// lesson drives both the horizontal and vertical layouts. Ported from orly.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const SEP = ' ';

export async function synthesizeLesson({
  spokenSegments,
  voiceId,
  apiKey = process.env.ELEVENLABS_API_KEY,
  modelId = 'eleven_multilingual_v2',
}) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required for TTS');
  const client = new ElevenLabsClient({ apiKey });

  let text = '';
  const offsets = [];
  spokenSegments.forEach((seg, i) => {
    if (i > 0) text += SEP;
    offsets.push(text.length);
    text += String(seg).trim();
  });

  const res = await client.textToSpeech.convertWithTimestamps(voiceId, { text, modelId });
  const mp3 = Buffer.from(res.audioBase64, 'base64');
  const al = res.alignment;
  const starts = al.characterStartTimesSeconds;
  const ends = al.characterEndTimesSeconds;
  const nChars = al.characters.length;
  const alignedExact = nChars === text.length;

  // Each scene's cue = start time of its first character (proportional fallback).
  const cues = offsets.map((off) => {
    if (alignedExact) return starts[Math.min(off, nChars - 1)] ?? 0;
    const frac = text.length ? off / text.length : 0;
    return (ends[nChars - 1] ?? 0) * frac;
  });
  for (let i = 1; i < cues.length; i++) if (cues[i] < cues[i - 1]) cues[i] = cues[i - 1];

  const audioEnd = ends[nChars - 1] ?? 0;
  return { mp3, cues, audioEnd, alignedExact, scriptLen: text.length, alignLen: nChars };
}
