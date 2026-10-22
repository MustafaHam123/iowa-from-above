import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  JOURNEY_STOPS,
  navigationGuidance,
  portalGuidance,
} from "../app/journeyStops";

declare function execute(slug: string, data: Record<string, unknown>): Promise<{
  successful: boolean;
  data?: { file?: { s3url?: string; url?: string } };
  error?: unknown;
}>;
declare const Bun: {
  write(path: string, data: ArrayBuffer): Promise<number>;
  file(path: string): { arrayBuffer(): Promise<ArrayBuffer> };
};

const VOICE_ID = "hpp4J3VqNfWAUOO0d1Us";
const STAGING_ROOT = "/private/tmp/iowa-environmental-narration-v2";
const OUTPUT_ROOT = join(process.cwd(), "public/audio");

const tutorial = [
  ["tutorial/01-introduction.mp3", "Hi, I'm Avery, and I'll be flying with you today. Before we head across Iowa, let's get comfortable with the controls."],
  ["tutorial/02-forward.mp3", "Hold W and ease the drone forward."],
  ["tutorial/03-backward.mp3", "Good. Now hold S to bring it backward."],
  ["tutorial/04-left.mp3", "Hold A to turn left."],
  ["tutorial/05-right.mp3", "And use D to turn right."],
  ["tutorial/06-ascend.mp3", "To gain altitude, hold E."],
  ["tutorial/07-descend.mp3", "To come back down, hold Q."],
  ["tutorial/08-boost.mp3", "Need a little more speed? Hold Shift while you fly."],
  ["tutorial/09-complete.mp3", "You've got it. Press Enter, then follow the purple route to the Iowa State Capitol. I'll meet you there."],
] as const;

const journey = JOURNEY_STOPS.flatMap((stop) =>
  stop.script.map((text, index) => ({
    path: `journey/${stop.id}-${String(index + 1).padStart(2, "0")}.mp3`,
    text,
  })),
);
const guidance = JOURNEY_STOPS.flatMap((stop, index) => [
  { path: `guidance/navigate-${stop.id}.mp3`, text: navigationGuidance(stop).message },
  ...(index > 0
    ? [{ path: `guidance/portal-${stop.id}.mp3`, text: portalGuidance(stop).message }]
    : []),
]);
const clips = [
  ...tutorial.map(([path, text]) => ({ path, text })),
  ...journey,
  ...guidance,
];

const totalCharacters = clips.reduce((total, clip) => total + clip.text.length, 0);
const largestClip = Math.max(...clips.map((clip) => clip.text.length));

if (totalCharacters >= 10_000 || largestClip >= 10_000) {
  throw new Error(`Narration exceeds the 10,000-character limit: ${totalCharacters} total, ${largestClip} largest clip.`);
}

for (const [index, clip] of clips.entries()) {
  const stagedPath = join(STAGING_ROOT, clip.path);
  mkdirSync(dirname(stagedPath), { recursive: true });

  if (existsSync(stagedPath) && statSync(stagedPath).size > 1_000) {
    console.log(`[${index + 1}/${clips.length}] Reusing ${clip.path}`);
    continue;
  }

  console.log(`[${index + 1}/${clips.length}] Generating ${clip.path} (${clip.text.length} characters)`);
  const result = await execute("ELEVENLABS_TEXT_TO_SPEECH", {
    voice_id: VOICE_ID,
    text: clip.text,
    model_id: "eleven_multilingual_v2",
    output_format: "mp3_44100_128",
    voice_settings: {
      stability: 0.8,
      similarity_boost: 0.7,
      style: 0,
      use_speaker_boost: true,
    },
    optimize_streaming_latency: 0,
    seed: 20260907,
  });

  const url = result.data?.file?.s3url ?? result.data?.file?.url;
  if (!result.successful || !url) {
    throw new Error(`ElevenLabs failed for ${clip.path}: ${JSON.stringify(result.error ?? result)}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Audio download failed for ${clip.path}: ${response.status}`);
  }
  await Bun.write(stagedPath, await response.arrayBuffer());
}

for (const clip of clips) {
  const outputPath = join(OUTPUT_ROOT, clip.path);
  mkdirSync(dirname(outputPath), { recursive: true });
  await Bun.write(
    outputPath,
    await Bun.file(join(STAGING_ROOT, clip.path)).arrayBuffer(),
  );
}

console.log(JSON.stringify({
  voice: "Bella - Professional, Bright, Warm",
  clips: clips.length,
  totalCharacters,
  largestClip,
  output: OUTPUT_ROOT,
}));
