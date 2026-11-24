// K.O.M.R.A.D.-84 Automated "Half-Life VOX" Word-Sprite & Clip Builder (Sector 84)
// Processes vox/*_all.(wav|ogg) (and vox/*.wav) + matching *_labels.txt files AND vox/komrad84_ai_scripts.txt + 01_*.ogg..06_*.ogg,
// slices/pads/normalizes words + full monologue clips, harvests missing isolated words,
// and exports compact 24kHz mono Ogg Vorbis (or 24kHz WAV fallback) + komrad_vox_manifest.json.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT_DIR = process.cwd();
const VOX_SRC_DIR = path.join(ROOT_DIR, "vox");
const VOX_OUT_DIR = path.join(ROOT_DIR, "public", "audio", "vox");
const CLIPS_OUT_DIR = path.join(VOX_OUT_DIR, "clips");
const MANIFEST_PATH = path.join(VOX_OUT_DIR, "komrad_vox_manifest.json");
const AI_SCRIPTS_FILENAME = "komrad84_ai_scripts.txt";
const HARVEST_PACK_ID = "komrad84_clips_harvest";
const IGNORED_TXT_FILES = new Set([
  AI_SCRIPTS_FILENAME,
  "found_komrad_lines_report.txt",
  "missing_vox_tts_batches.txt",
]);

const PRE_ROLL_SEC = 0.032; // 32ms pre-roll
const POST_ROLL_SEC = 0.08; // 80ms post-roll
const FADE_IN_SEC = 0.014; // 14ms cosine fade-in
const FADE_OUT_SEC = 0.035; // 35ms cosine fade-out
const ACTIVE_SAMPLE_THRESHOLD = 0.0008;
const RMS_SAMPLE_THRESHOLD = 0.006;
const TARGET_ACTIVE_RMS = 0.115;
const MIN_GAIN = 0.6;
const MAX_GAIN = 1.8;
const FALLBACK_SAMPLE_RATE = 24000;

const HARVEST_PRE_ROLL_SEC = 0.024;
const HARVEST_POST_ROLL_SEC = 0.055;
const HARVEST_FADE_IN_SEC = 0.014;
const HARVEST_FADE_OUT_SEC = 0.032;
const HARVEST_GAP_SEC = 0.12;
const HARVEST_MIN_DUR_SEC = 0.13;
const HARVEST_MAX_DUR_SEC = 1.25;

function roundTo(val, decimals) {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function normalizeWordKey(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function checkFfmpegAvailable() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findMatchingLabelFile(packStem, txtFiles) {
  const candidates = [
    `${packStem}.txt`,
    `${packStem.replace(/_all$/i, "")}_labels.txt`,
    `${packStem}_labels.txt`,
  ];
  const lowerMap = new Map(txtFiles.map((f) => [f.toLowerCase(), f]));

  // Match strictly against explicit pack-stem label names so unpaired helper .txt files are ignored
  for (const cand of candidates) {
    if (txtFiles.includes(cand)) return cand;
    const ci = lowerMap.get(cand.toLowerCase());
    if (ci) return ci;
  }
  return null;
}

function parseWavMonoFloat32(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 44) {
    throw new Error(`Invalid WAV file (too small): ${filePath}`);
  }
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`Unsupported RIFF/WAVE header in ${filePath}`);
  }

  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const chunkBody = offset + 8;

    if (chunkId === "fmt ") {
      if (chunkSize < 16 || chunkBody + 16 > buf.length) {
        throw new Error(`Corrupt fmt chunk in ${filePath}`);
      }
      audioFormat = buf.readUInt16LE(chunkBody);
      channels = buf.readUInt16LE(chunkBody + 2);
      sampleRate = buf.readUInt32LE(chunkBody + 4);
      bitsPerSample = buf.readUInt16LE(chunkBody + 14);
      // Support WAVE_FORMAT_EXTENSIBLE (0xFFFE) if subformat matches PCM(1) or Float(3)
      if (audioFormat === 0xfffe && chunkSize >= 40 && chunkBody + 26 <= buf.length) {
        audioFormat = buf.readUInt16LE(chunkBody + 24);
      }
    } else if (chunkId === "data") {
      dataOffset = chunkBody;
      dataSize = Math.min(chunkSize, buf.length - chunkBody);
      break;
    }

    offset = chunkBody + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || !sampleRate || !channels || !bitsPerSample) {
    throw new Error(`Missing fmt or data chunk in ${filePath}`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * channels;
  const frameCount = Math.floor(dataSize / frameSize);
  const mono = new Float32Array(frameCount);

  if (audioFormat === 1 && bitsPerSample === 16) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0;
      const base = dataOffset + i * frameSize;
      for (let ch = 0; ch < channels; ch++) {
        sum += buf.readInt16LE(base + ch * 2) / 32768;
      }
      mono[i] = sum / channels;
    }
  } else if (audioFormat === 1 && bitsPerSample === 24) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0;
      const base = dataOffset + i * frameSize;
      for (let ch = 0; ch < channels; ch++) {
        const bOff = base + ch * 3;
        let val = buf[bOff] | (buf[bOff + 1] << 8) | (buf[bOff + 2] << 16);
        if (val & 0x800000) val -= 0x1000000;
        sum += val / 8388608;
      }
      mono[i] = sum / channels;
    }
  } else if (audioFormat === 1 && bitsPerSample === 32) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0;
      const base = dataOffset + i * frameSize;
      for (let ch = 0; ch < channels; ch++) {
        sum += buf.readInt32LE(base + ch * 4) / 2147483648;
      }
      mono[i] = sum / channels;
    }
  } else if (audioFormat === 3 && bitsPerSample === 32) {
    for (let i = 0; i < frameCount; i++) {
      let sum = 0;
      const base = dataOffset + i * frameSize;
      for (let ch = 0; ch < channels; ch++) {
        sum += buf.readFloatLE(base + ch * 4);
      }
      mono[i] = sum / channels;
    }
  } else {
    throw new Error(
      `Unsupported WAV format (format=${audioFormat}, bits=${bitsPerSample}) in ${filePath}`,
    );
  }

  return { samples: mono, sampleRate };
}

function encodeMono16WavBuffer(samples, sampleRate) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const out = Buffer.allocUnsafe(44 + dataSize);

  out.write("RIFF", 0, 4, "ascii");
  out.writeUInt32LE(36 + dataSize, 4);
  out.write("WAVE", 8, 4, "ascii");

  out.write("fmt ", 12, 4, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // Mono
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  out.writeUInt16LE(2, 32); // BlockAlign
  out.writeUInt16LE(16, 34); // BitsPerSample

  out.write("data", 36, 4, "ascii");
  out.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = clamp(samples[i], -1, 1);
    const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    out.writeInt16LE(clamp(int16, -32768, 32767), 44 + i * 2);
  }
  return out;
}

function resampleLinear(samples, srcRate, dstRate) {
  if (srcRate === dstRate) return samples;
  const dstLen = Math.max(1, Math.round((samples.length * dstRate) / srcRate));
  const out = new Float32Array(dstLen);
  const ratio = srcRate / dstRate;
  for (let i = 0; i < dstLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = srcIdx - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

function parseLabelsFile(labelPath) {
  const rawText = fs.readFileSync(labelPath, "utf8").replace(/^\uFEFF/, "");
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const tsRegex = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.+?)$/;
  const timestampEntries = [];
  for (const line of lines) {
    const m = line.match(tsRegex);
    if (m) {
      const start = Number.parseFloat(m[1]);
      const end = Number.parseFloat(m[2]);
      const rawLabel = m[3].trim();
      const key = normalizeWordKey(rawLabel);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start && key) {
        timestampEntries.push({ start, end, key, rawLabel });
      }
    }
  }

  if (lines.length > 0 && timestampEntries.length >= Math.ceil(lines.length * 0.8)) {
    return {
      mode: "audacity-timestamps",
      entries: timestampEntries,
      wordCount: timestampEntries.length,
    };
  }

  // Unlabeled word list (newline / period / comma / whitespace separated)
  const words = [];
  for (const line of lines) {
    const tokens = line.split(/[\s.,;!?]+/);
    for (const tok of tokens) {
      const key = normalizeWordKey(tok);
      if (key) {
        words.push({ key, rawLabel: tok });
      }
    }
  }
  return {
    mode: "word-list-envelope",
    entries: words,
    wordCount: words.length,
  };
}

function refineActiveBounds(
  samples,
  sampleRate,
  startSec,
  endSec,
  prevBoundSec = 0,
  nextBoundSec = samples.length / sampleRate,
) {
  const i0 = clamp(Math.floor(startSec * sampleRate), 0, samples.length - 1);
  const i1 = clamp(Math.ceil(endSec * sampleRate), i0 + 1, samples.length);

  let firstActive = i1;
  let lastActive = i0;
  for (let i = i0; i < i1; i++) {
    if (Math.abs(samples[i]) >= ACTIVE_SAMPLE_THRESHOLD) {
      if (firstActive === i1) firstActive = i;
      lastActive = i;
    }
  }

  if (firstActive >= lastActive) {
    return { activeStart: startSec, activeEnd: endSec };
  }

  // Expand outward in small lookahead windows so quiet consonant attacks/tails are never shaved off
  const minSample = clamp(Math.floor(prevBoundSec * sampleRate), 0, firstActive);
  const maxSample = clamp(Math.ceil(nextBoundSec * sampleRate), lastActive + 1, samples.length);
  const maxBackSamples = Math.round(0.06 * sampleRate);
  const maxFwdSamples = Math.round(0.09 * sampleRate);
  const lookSamples = Math.max(1, Math.round(0.01 * sampleRate));

  const backFloor = Math.max(minSample, firstActive - maxBackSamples);
  while (firstActive > backFloor) {
    const winStart = Math.max(backFloor, firstActive - lookSamples);
    let hit = -1;
    for (let i = winStart; i < firstActive; i++) {
      if (Math.abs(samples[i]) >= ACTIVE_SAMPLE_THRESHOLD) {
        hit = i;
        break;
      }
    }
    if (hit < 0) break;
    firstActive = hit;
  }

  const fwdCeil = Math.min(maxSample, lastActive + 1 + maxFwdSamples);
  while (lastActive + 1 < fwdCeil) {
    const winEnd = Math.min(fwdCeil, lastActive + 1 + lookSamples);
    let hit = -1;
    for (let i = lastActive + 1; i < winEnd; i++) {
      if (Math.abs(samples[i]) >= ACTIVE_SAMPLE_THRESHOLD) {
        hit = i;
      }
    }
    if (hit < 0) break;
    lastActive = hit;
  }

  return {
    activeStart: firstActive / sampleRate,
    activeEnd: (lastActive + 1) / sampleRate,
  };
}

function computeFrameRms(samples, sampleRate, hopSec = 0.01, winSec = 0.02) {
  const hopSamples = Math.max(1, Math.round(sampleRate * hopSec));
  const winSamples = Math.max(hopSamples, Math.round(sampleRate * winSec));
  const frameCount = Math.max(1, Math.ceil((samples.length - winSamples) / hopSamples) + 1);
  const rms = new Float32Array(frameCount);

  for (let f = 0; f < frameCount; f++) {
    const s0 = f * hopSamples;
    const s1 = Math.min(samples.length, s0 + winSamples);
    let sum = 0;
    for (let i = s0; i < s1; i++) {
      const v = samples[i];
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / Math.max(1, s1 - s0));
  }
  return { rms, hopSec };
}

function detectSegmentsWithMergeGap(rms, hopSec, threshold, mergeGapSec, minDurSec = 0.04) {
  const rawIslands = [];
  let inSpeech = false;
  let startFrame = 0;

  for (let f = 0; f < rms.length; f++) {
    if (rms[f] >= threshold) {
      if (!inSpeech) {
        inSpeech = true;
        startFrame = f;
      }
    } else if (inSpeech) {
      inSpeech = false;
      rawIslands.push({
        start: startFrame * hopSec,
        end: f * hopSec,
      });
    }
  }
  if (inSpeech) {
    rawIslands.push({
      start: startFrame * hopSec,
      end: rms.length * hopSec,
    });
  }

  if (rawIslands.length === 0) return [];

  const merged = [{ ...rawIslands[0] }];
  for (let i = 1; i < rawIslands.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = rawIslands[i];
    if (cur.start - prev.end <= mergeGapSec) {
      prev.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }

  return merged.filter((seg) => seg.end - seg.start >= minDurSec);
}

function detectEnvelopeSegments(samples, sampleRate, targetCount) {
  const { rms, hopSec } = computeFrameRms(samples, sampleRate, 0.01, 0.02);
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] ?? 0;
  const threshold = Math.max(0.008, noiseFloor * 3.5);

  let bestSegments = [];
  let bestDiff = Number.POSITIVE_INFINITY;

  for (let gapMs = 60; gapMs <= 600; gapMs += 20) {
    const segs = detectSegmentsWithMergeGap(rms, hopSec, threshold, gapMs / 1000);
    const diff = Math.abs(segs.length - targetCount);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSegments = segs;
      if (diff === 0) break;
    }
  }

  if (bestSegments.length === 0) {
    throw new Error("Envelope detector found 0 spoken segments in audio pack.");
  }

  // Merge smallest gaps first if over-segmented (e.g., plosive closures inside long words)
  while (bestSegments.length > targetCount && bestSegments.length > 1) {
    let minIdx = 0;
    let minGap = Number.POSITIVE_INFINITY;
    for (let i = 0; i < bestSegments.length - 1; i++) {
      const gap = bestSegments[i + 1].start - bestSegments[i].end;
      if (gap < minGap) {
        minGap = gap;
        minIdx = i;
      }
    }
    bestSegments[minIdx].end = bestSegments[minIdx + 1].end;
    bestSegments.splice(minIdx + 1, 1);
  }

  // Split longest segments at lowest internal RMS dip if under-segmented
  const minEdgeSec = 0.06;
  while (bestSegments.length < targetCount) {
    let splitIdx = -1;
    let bestLen = 0;
    for (let i = 0; i < bestSegments.length; i++) {
      const dur = bestSegments[i].end - bestSegments[i].start;
      if (dur > bestLen && dur >= minEdgeSec * 2.2) {
        bestLen = dur;
        splitIdx = i;
      }
    }
    if (splitIdx < 0) break;

    const seg = bestSegments[splitIdx];
    const fStart = Math.max(0, Math.ceil((seg.start + minEdgeSec) / hopSec));
    const fEnd = Math.min(rms.length - 1, Math.floor((seg.end - minEdgeSec) / hopSec));
    let minFrame = Math.floor((fStart + fEnd) / 2);
    let minVal = Number.POSITIVE_INFINITY;
    for (let f = fStart; f <= fEnd; f++) {
      if (rms[f] < minVal) {
        minVal = rms[f];
        minFrame = f;
      }
    }
    const splitSec = minFrame * hopSec;
    bestSegments.splice(
      splitIdx,
      1,
      { start: seg.start, end: splitSec },
      { start: splitSec, end: seg.end },
    );
  }

  return bestSegments;
}

function computeActiveRms(samples, sampleRate, activeStart, activeEnd) {
  const i0 = clamp(Math.floor(activeStart * sampleRate), 0, samples.length - 1);
  const i1 = clamp(Math.ceil(activeEnd * sampleRate), i0 + 1, samples.length);

  let activeSum = 0;
  let activeCount = 0;
  let fullSum = 0;
  for (let i = i0; i < i1; i++) {
    const v = samples[i];
    const sq = v * v;
    fullSum += sq;
    if (Math.abs(v) >= RMS_SAMPLE_THRESHOLD) {
      activeSum += sq;
      activeCount += 1;
    }
  }

  if (activeCount > 0) {
    return Math.sqrt(activeSum / activeCount);
  }
  return Math.sqrt(fullSum / Math.max(1, i1 - i0));
}

function encodeSamplesToTarget(samples, sampleRate, outDir, outStem, ffmpegAvailable) {
  fs.mkdirSync(outDir, { recursive: true });
  let outFileName;
  let outPath;
  if (ffmpegAvailable) {
    outFileName = `${outStem}.ogg`;
    outPath = path.join(outDir, outFileName);
    const tmpWav = path.join(os.tmpdir(), `${outStem}_${process.pid}.wav`);
    try {
      fs.writeFileSync(tmpWav, encodeMono16WavBuffer(samples, sampleRate));
      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-v",
          "error",
          "-i",
          tmpWav,
          "-c:a",
          "libvorbis",
          "-q:a",
          "4",
          "-ac",
          "1",
          "-ar",
          String(FALLBACK_SAMPLE_RATE),
          outPath,
        ],
        { stdio: "inherit" },
      );
    } finally {
      if (fs.existsSync(tmpWav)) {
        fs.unlinkSync(tmpWav);
      }
    }
  } else {
    outFileName = `${outStem}.wav`;
    outPath = path.join(outDir, outFileName);
    const resampled = resampleLinear(samples, sampleRate, FALLBACK_SAMPLE_RATE);
    fs.writeFileSync(outPath, encodeMono16WavBuffer(resampled, FALLBACK_SAMPLE_RATE));
  }

  const outBytes = fs.statSync(outPath).size;
  return { outFileName, outPath, outBytes };
}

function decodeAudioToMonoFloat32(filePath, ffmpegAvailable, targetRate = FALLBACK_SAMPLE_RATE) {
  if (/\.wav$/i.test(filePath) && !ffmpegAvailable) {
    const parsed = parseWavMonoFloat32(filePath);
    return {
      samples: resampleLinear(parsed.samples, parsed.sampleRate, targetRate),
      sampleRate: targetRate,
    };
  }
  if (!ffmpegAvailable) {
    throw new Error(`ffmpeg is required to decode ${path.basename(filePath)}`);
  }
  const pcmBuf = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      filePath,
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      String(targetRate),
      "pipe:1",
    ],
    // Long multi-minute .ogg packs (e.g. ~28 min @ 24kHz f32le = ~160 MB) exceed 64 MB
    { maxBuffer: 512 * 1024 * 1024 },
  );
  const floatLen = Math.floor(pcmBuf.byteLength / 4);
  const samples = new Float32Array(floatLen);
  if (os.endianness() === "LE") {
    new Uint8Array(samples.buffer).set(pcmBuf.subarray(0, floatLen * 4));
  } else {
    for (let i = 0; i < floatLen; i++) {
      samples[i] = pcmBuf.readFloatLE(i * 4);
    }
  }
  return { samples, sampleRate: targetRate };
}

function applyCosineFades(buf, startIdx, endIdx, fadeInSamples, fadeOutSamples) {
  const len = endIdx - startIdx;
  if (len <= 0) return;
  const localIn = Math.min(fadeInSamples, Math.floor(len * 0.35));
  const localOut = Math.min(fadeOutSamples, Math.floor(len * 0.45));

  for (let k = 0; k < localIn; k++) {
    const env = 0.5 * (1 - Math.cos((Math.PI * (k + 0.5)) / localIn));
    buf[startIdx + k] *= env;
  }
  for (let k = 0; k < localOut; k++) {
    const env = 0.5 * (1 - Math.cos((Math.PI * (k + 0.5)) / localOut));
    buf[endIdx - 1 - k] *= env;
  }
}

function processPack(audioFile, labelFile, ffmpegAvailable) {
  const packId = audioFile.replace(/\.(wav|ogg)$/i, "");
  const audioPath = path.join(VOX_SRC_DIR, audioFile);
  const labelPath = path.join(VOX_SRC_DIR, labelFile);

  const isWav = /\.wav$/i.test(audioFile);
  const { samples, sampleRate } = isWav
    ? parseWavMonoFloat32(audioPath)
    : decodeAudioToMonoFloat32(audioPath, ffmpegAvailable, FALLBACK_SAMPLE_RATE);
  const totalDurSec = samples.length / sampleRate;
  const parsed = parseLabelsFile(labelPath);

  let rawSegments;
  let detectedSegments = 0;
  if (parsed.mode === "audacity-timestamps") {
    rawSegments = parsed.entries.map((e, idx) => {
      const prevBound = idx > 0 ? parsed.entries[idx - 1].end : 0;
      const nextBound = idx + 1 < parsed.entries.length ? parsed.entries[idx + 1].start : totalDurSec;
      const { activeStart, activeEnd } = refineActiveBounds(
        samples,
        sampleRate,
        e.start,
        e.end,
        prevBound,
        nextBound,
      );
      return {
        key: e.key,
        rawLabel: e.rawLabel,
        activeStart,
        activeEnd,
      };
    });
    detectedSegments = rawSegments.length;
  } else {
    const envelopeSegs = detectEnvelopeSegments(samples, sampleRate, parsed.wordCount);
    detectedSegments = envelopeSegs.length;
    rawSegments = parsed.entries.map((entry, idx) => {
      const seg = envelopeSegs[idx];
      const prevBound = idx > 0 && envelopeSegs[idx - 1] ? envelopeSegs[idx - 1].end : 0;
      const nextBound =
        idx + 1 < envelopeSegs.length && envelopeSegs[idx + 1]
          ? envelopeSegs[idx + 1].start
          : totalDurSec;
      const { activeStart, activeEnd } = seg
        ? refineActiveBounds(samples, sampleRate, seg.start, seg.end, prevBound, nextBound)
        : { activeStart: 0, activeEnd: 0.05 };
      return {
        key: entry.key,
        rawLabel: entry.rawLabel,
        activeStart,
        activeEnd,
      };
    });
  }

  // Apply 32ms pre-roll, 80ms post-roll, clamp against neighbor midpoints, and compute RMS gain
  const sliced = rawSegments.map((seg) => ({
    ...seg,
    start: Math.max(0, seg.activeStart - PRE_ROLL_SEC),
    end: Math.min(totalDurSec, seg.activeEnd + POST_ROLL_SEC),
  }));

  for (let i = 0; i < sliced.length - 1; i++) {
    const cur = sliced[i];
    const next = sliced[i + 1];
    if (cur.end > next.start) {
      const mid = (cur.activeEnd + next.activeStart) * 0.5;
      cur.end = Math.min(cur.end, mid);
      next.start = Math.max(next.start, mid);
    }
  }

  // Construct clean processed mono audio with 14ms cosine fade-in / 35ms cosine fade-out and zeroed gaps
  const processed = new Float32Array(samples.length);
  const fadeInSamples = Math.max(1, Math.round(FADE_IN_SEC * sampleRate));
  const fadeOutSamples = Math.max(1, Math.round(FADE_OUT_SEC * sampleRate));
  const wordEntries = [];

  for (const item of sliced) {
    const i0 = clamp(Math.floor(item.start * sampleRate), 0, samples.length - 1);
    const i1 = clamp(Math.ceil(item.end * sampleRate), i0 + 1, samples.length);
    for (let i = i0; i < i1; i++) {
      processed[i] = samples[i];
    }
    applyCosineFades(processed, i0, i1, fadeInSamples, fadeOutSamples);

    const activeRms = computeActiveRms(samples, sampleRate, item.activeStart, item.activeEnd);
    const gain = roundTo(
      clamp(TARGET_ACTIVE_RMS / Math.max(activeRms, 1e-4), MIN_GAIN, MAX_GAIN),
      3,
    );
    const startSec = roundTo(i0 / sampleRate, 4);
    const durSec = roundTo((i1 - i0) / sampleRate, 4);

    wordEntries.push({
      key: item.key,
      pack: packId,
      start: startSec,
      dur: durSec,
      gain,
    });
  }

  if (detectedSegments !== parsed.wordCount || wordEntries.length !== parsed.wordCount) {
    throw new Error(
      `[VOX] Word-count mismatch in ${packId}: labels=${parsed.wordCount}, detected=${detectedSegments}, sliced=${wordEntries.length} (${labelFile})`,
    );
  }

  const { outFileName, outPath, outBytes } = encodeSamplesToTarget(
    processed,
    sampleRate,
    VOX_OUT_DIR,
    packId,
    ffmpegAvailable,
  );

  return {
    packId,
    labelFile,
    labelMode: parsed.mode,
    wordCount: parsed.wordCount,
    detectedSegments,
    src: `./audio/vox/${outFileName}`,
    outPath,
    outBytes,
    wordEntries,
  };
}

function parseAiScriptsFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  const headerRe = /^(\d+)\.\s+(.+?)\s*\([^)]+\)\s*-\s*(\S+\.ogg)\s*$/i;
  const specs = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hm = trimmed.match(headerRe);
    if (hm) {
      const fileName = hm[3].trim();
      current = {
        index: Number.parseInt(hm[1], 10),
        id: fileName.replace(/\.ogg$/i, ""),
        title: hm[2].trim(),
        fileName,
        items: [],
        speechLines: [],
      };
      specs.push(current);
      continue;
    }

    if (!current) continue;
    if (/^\[glitch\]$/i.test(trimmed)) {
      current.items.push({ kind: "glitch" });
    } else if (/^AI:\s*/i.test(trimmed)) {
      const text = trimmed.replace(/^AI:\s*/i, "").trim();
      if (text) {
        current.items.push({ kind: "speech", text });
        current.speechLines.push(text);
      }
    }
  }

  return specs;
}

function splitSpeechUnits(items, splitColons) {
  const units = [];
  let pendingGlitch = false;

  for (const item of items) {
    if (item.kind === "glitch") {
      pendingGlitch = true;
      continue;
    }
    const sentences = item.text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [item.text];
    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      if (splitColons) {
        const colonIdx = sentence.indexOf(":");
        if (colonIdx > 0) {
          const prefix = sentence.slice(0, colonIdx + 1).trim();
          const rest = sentence.slice(colonIdx + 1).trim();
          const prefixWords = prefix.split(/\s+/).filter(Boolean);
          if (prefixWords.length >= 2 && rest.length > 0) {
            units.push({ text: prefix, afterGlitch: pendingGlitch });
            pendingGlitch = false;
            units.push({ text: rest, afterGlitch: false });
            continue;
          }
        }
      }
      units.push({ text: sentence, afterGlitch: pendingGlitch });
      pendingGlitch = false;
    }
  }
  return units;
}

function tokenizeClauseWords(clauseText) {
  const out = [];
  const rawTokens = clauseText.split(/\s+/).filter(Boolean);
  for (const rawTok of rawTokens) {
    const hasPauseAfter = /[,:;]$/.test(rawTok);
    const cleaned = rawTok.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9-]+$/g, "");
    if (!cleaned) continue;
    // Always split hyphenated words (e.g. "eighty-four") because continuous clips articulate them as separate islands
    if (!cleaned.includes("-")) {
      out.push({ key: cleaned, hasPauseAfter });
      continue;
    }
    const parts = cleaned.split("-").filter(Boolean);
    for (let pi = 0; pi < parts.length; pi++) {
      out.push({
        key: parts[pi],
        hasPauseAfter: pi === parts.length - 1 ? hasPauseAfter : false,
      });
    }
  }
  return out;
}

function estimateWordWeight(wordKey, hasPauseAfter) {
  const clusters = wordKey.match(/[aeiouy]+/g)?.length ?? 1;
  const base = Math.max(1.4, clusters * 1.45 + wordKey.length * 0.22);
  return base + (hasPauseAfter ? 1.15 : 0);
}

function alignWordsWithDp(rms, hopSec, clauseStartSec, clauseEndSec, words, speechThr) {
  const f0 = clamp(Math.floor(clauseStartSec / hopSec), 0, rms.length - 1);
  const f1 = clamp(Math.ceil(clauseEndSec / hopSec), f0 + 1, rms.length);
  const totalFrames = f1 - f0;
  const W = words.length;
  if (W === 0 || totalFrames <= 0) return [];
  if (W === 1) {
    return [{ start: f0 * hopSec, end: f1 * hopSec, mode: "dp-single" }];
  }

  let peakClauseRms = 1e-4;
  for (let f = f0; f < f1; f++) {
    if (rms[f] > peakClauseRms) peakClauseRms = rms[f];
  }

  const weights = words.map((w) => estimateWordWeight(w.key, w.hasPauseAfter));
  const totalWeight = weights.reduce((acc, v) => acc + v, 0);
  const cumWeight = [0];
  for (let i = 0; i < W; i++) {
    cumWeight.push(cumWeight[i] + weights[i] / totalWeight);
  }

  const minWordFrames = Math.max(4, Math.min(11, Math.floor(totalFrames / W)));
  const INF = 1e12;
  const dp = Array.from({ length: W + 1 }, () => new Float64Array(totalFrames + 1).fill(INF));
  const parent = Array.from({ length: W + 1 }, () => new Int32Array(totalFrames + 1).fill(-1));
  dp[0][0] = 0;

  // Frame boundary energy penalty: low-RMS valleys strongly preferred as cut points
  const boundCost = new Float64Array(totalFrames + 1);
  for (let j = 1; j < totalFrames; j++) {
    const f = f0 + j;
    const prevR = rms[Math.max(f0, f - 1)];
    const curR = rms[f];
    const nextR = rms[Math.min(f1 - 1, f + 1)];
    const minNeigh = Math.min(prevR, curR, nextR);
    const ratio = minNeigh / peakClauseRms;
    const isValley = curR <= prevR && curR <= nextR;
    const isSilent = minNeigh < speechThr;
    boundCost[j] = ratio * 3.8 - (isSilent ? 1.15 : 0) - (isValley ? 0.25 : 0);
  }

  for (let k = 1; k <= W; k++) {
    const minJ = k * minWordFrames;
    const maxJ = totalFrames - (W - k) * minWordFrames;
    if (k === W) {
      const j = totalFrames;
      const expectedEnd = totalFrames;
      for (let prev = (k - 1) * minWordFrames; prev <= j - minWordFrames; prev++) {
        const prevCost = dp[k - 1][prev];
        if (prevCost >= INF * 0.5) continue;
        const expectedDur = (weights[k - 1] / totalWeight) * totalFrames;
        const durErr = Math.abs(j - prev - expectedDur) / Math.max(6, totalFrames);
        const cost = prevCost + durErr * 1.4;
        if (cost < dp[k][j]) {
          dp[k][j] = cost;
          parent[k][j] = prev;
        }
      }
      void expectedEnd;
      continue;
    }

    const expectedEnd = cumWeight[k] * totalFrames;
    for (let j = minJ; j <= maxJ; j++) {
      const posErr = Math.abs(j - expectedEnd) / Math.max(8, totalFrames);
      let best = INF;
      let bestPrev = -1;
      for (let prev = (k - 1) * minWordFrames; prev <= j - minWordFrames; prev++) {
        const prevCost = dp[k - 1][prev];
        if (prevCost >= INF * 0.5) continue;
        const expectedDur = (weights[k - 1] / totalWeight) * totalFrames;
        const durErr = Math.abs(j - prev - expectedDur) / Math.max(6, totalFrames);
        const cand = prevCost + durErr * 1.1;
        if (cand < best) {
          best = cand;
          bestPrev = prev;
        }
      }
      if (bestPrev >= 0) {
        dp[k][j] = best + boundCost[j] + posErr * 1.8;
        parent[k][j] = bestPrev;
      }
    }
  }

  const cuts = new Array(W + 1);
  cuts[W] = totalFrames;
  for (let k = W; k >= 1; k--) {
    const p = parent[k][cuts[k]];
    cuts[k - 1] = p >= 0 ? p : Math.round(((k - 1) * totalFrames) / W);
  }

  const out = [];
  for (let k = 0; k < W; k++) {
    out.push({
      start: (f0 + cuts[k]) * hopSec,
      end: (f0 + cuts[k + 1]) * hopSec,
      mode: "dp-valley",
    });
  }
  return out;
}

function tightenSliceByRms(rms, hopSec, segStartSec, segEndSec, speechThr) {
  const f0 = clamp(Math.floor(segStartSec / hopSec), 0, rms.length - 1);
  const f1 = clamp(Math.ceil(segEndSec / hopSec), f0 + 1, rms.length);

  let peakRms = 0;
  for (let f = f0; f < f1; f++) {
    if (rms[f] > peakRms) peakRms = rms[f];
  }
  const activeThr = Math.max(speechThr * 0.85, peakRms * 0.14);

  let firstF = f1;
  let lastF = f0;
  for (let f = f0; f < f1; f++) {
    if (rms[f] >= activeThr) {
      if (firstF === f1) firstF = f;
      lastF = f;
    }
  }
  if (firstF >= lastF) {
    return {
      activeStart: segStartSec,
      activeEnd: segEndSec,
      peakRms,
      leftEdgeRms: rms[f0] ?? 0,
      rightEdgeRms: rms[Math.max(f0, f1 - 1)] ?? 0,
    };
  }

  return {
    activeStart: Math.max(segStartSec, firstF * hopSec),
    activeEnd: Math.min(segEndSec, (lastF + 1) * hopSec),
    peakRms,
    leftEdgeRms: rms[Math.max(0, firstF - 1)] ?? 0,
    rightEdgeRms: rms[Math.min(rms.length - 1, lastF + 1)] ?? 0,
  };
}

function isExactIslandAlignmentProportional(islands, clauseWords) {
  if (islands.length !== clauseWords.length || islands.length === 0) return false;
  if (islands.length === 1) return true;

  const weights = clauseWords.map((w) => estimateWordWeight(w.key, false));
  const totalWeight = weights.reduce((acc, v) => acc + v, 0);
  const durs = islands.map((isl) => isl.end - isl.start);
  const totalDur = durs.reduce((acc, v) => acc + v, 0);
  if (totalWeight <= 0 || totalDur <= 0) return false;

  for (let k = 0; k < clauseWords.length; k++) {
    const expectedFrac = weights[k] / totalWeight;
    const actualFrac = durs[k] / totalDur;
    const ratio = actualFrac / Math.max(expectedFrac, 1e-4);
    if (ratio < 0.45 || ratio > 2.25) return false;

    const vowelClusters = clauseWords[k].key.match(/[aeiouy]+/g)?.length ?? 1;
    if (vowelClusters >= 2 && durs[k] < 0.14) return false;
  }
  return true;
}

function processAiClipsAndHarvestWords(scripts, baseWordKeys, ffmpegAvailable) {
  const clipsOut = [];
  const bestCandidateByWord = new Map();

  for (const spec of scripts) {
    const clipPath = path.join(VOX_SRC_DIR, spec.fileName);
    if (!fs.existsSync(clipPath)) {
      console.warn(`[VOX] Clip listed in ${AI_SCRIPTS_FILENAME} not found: ${spec.fileName}`);
      continue;
    }

    const { samples, sampleRate } = decodeAudioToMonoFloat32(
      clipPath,
      ffmpegAvailable,
      FALLBACK_SAMPLE_RATE,
    );
    const totalDurSec = samples.length / sampleRate;
    const { rms, hopSec } = computeFrameRms(samples, sampleRate, 0.01, 0.02);
    const sortedRms = Array.from(rms).sort((a, b) => a - b);
    const noiseFloor = sortedRms[Math.floor(sortedRms.length * 0.1)] ?? 0.01;
    const speechThr = Math.max(0.008, noiseFloor * 2.8);

    // Compute active RMS over spoken frames & peak-safe normalization gain
    let activeSqSum = 0;
    let activeFrameCount = 0;
    for (let f = 0; f < rms.length; f++) {
      if (rms[f] >= speechThr) {
        activeSqSum += rms[f] * rms[f];
        activeFrameCount += 1;
      }
    }
    const activeRms = activeFrameCount > 0 ? Math.sqrt(activeSqSum / activeFrameCount) : TARGET_ACTIVE_RMS;
    let peakAbs = 0.01;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > peakAbs) peakAbs = a;
    }
    const rawNormGain = clamp(TARGET_ACTIVE_RMS / Math.max(activeRms, 1e-4), 0.55, 1.8);
    const normGain = Math.min(rawNormGain, 0.92 / peakAbs);

    const normalized = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      normalized[i] = clamp(samples[i] * normGain, -0.98, 0.98);
    }
    const clipEdgeFade = Math.round(0.01 * sampleRate);
    applyCosineFades(normalized, 0, normalized.length, clipEdgeFade, clipEdgeFade);

    const encodedClip = encodeSamplesToTarget(
      normalized,
      sampleRate,
      CLIPS_OUT_DIR,
      spec.id,
      ffmpegAvailable,
    );

    // Clause alignment: detect >=450ms speech islands and match against sentence or colon-split units
    const coarseIslands = detectSegmentsWithMergeGap(rms, hopSec, speechThr, 0.45, 0.08);
    const sentenceUnits = splitSpeechUnits(spec.items, false);
    const colonUnits = splitSpeechUnits(spec.items, true);

    let chosenUnits = sentenceUnits;
    if (
      Math.abs(coarseIslands.length - colonUnits.length) <
      Math.abs(coarseIslands.length - sentenceUnits.length)
    ) {
      chosenUnits = colonUnits;
    }

    let alignedIslands = coarseIslands.map((seg) => ({ ...seg }));
    if (alignedIslands.length !== chosenUnits.length) {
      // Fallback sweep across merge gaps 0.25..0.55s to match expected clause count
      let bestSegs = alignedIslands;
      let bestDiff = Math.abs(alignedIslands.length - chosenUnits.length);
      for (let gapMs = 250; gapMs <= 550; gapMs += 25) {
        const cand = detectSegmentsWithMergeGap(rms, hopSec, speechThr, gapMs / 1000, 0.08);
        const diff = Math.abs(cand.length - chosenUnits.length);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSegs = cand;
          if (diff === 0) break;
        }
      }
      alignedIslands = bestSegs.map((seg) => ({ ...seg }));
      while (alignedIslands.length > chosenUnits.length && alignedIslands.length > 1) {
        let minIdx = 0;
        let minGap = Number.POSITIVE_INFINITY;
        for (let i = 0; i < alignedIslands.length - 1; i++) {
          const gap = alignedIslands[i + 1].start - alignedIslands[i].end;
          if (gap < minGap) {
            minGap = gap;
            minIdx = i;
          }
        }
        alignedIslands[minIdx].end = alignedIslands[minIdx + 1].end;
        alignedIslands.splice(minIdx + 1, 1);
      }
    }

    const clauses = [];
    for (let ui = 0; ui < chosenUnits.length; ui++) {
      const unit = chosenUnits[ui];
      const rawSeg = alignedIslands[ui];
      if (!rawSeg) continue;

      let cStart = rawSeg.start;
      let cEnd = rawSeg.end;

      // Strip leading [glitch] burst from post-glitch clause if separated by >= 180ms dip
      if (unit.afterGlitch) {
        const fA = clamp(Math.floor(cStart / hopSec), 0, rms.length - 1);
        const fB = clamp(Math.ceil(cEnd / hopSec), fA + 1, rms.length);
        const localIslands = detectSegmentsWithMergeGap(
          rms.slice(fA, fB),
          hopSec,
          speechThr,
          0.18,
          0.08,
        );
        if (localIslands.length >= 2) {
          const firstDur = localIslands[0].end - localIslands[0].start;
          const gapAfterFirst = localIslands[1].start - localIslands[0].end;
          if (firstDur >= 0.25 && firstDur <= 0.78 && gapAfterFirst >= 0.18) {
            cStart = roundTo(fA * hopSec + localIslands[1].start, 3);
          }
        }
      }

      clauses.push({
        start: roundTo(clamp(cStart, 0, totalDurSec), 3),
        end: roundTo(clamp(cEnd, cStart + 0.05, totalDurSec), 3),
        text: unit.text,
      });

      // Harvest missing isolated words from this clean spoken clause
      const clauseWords = tokenizeClauseWords(unit.text);
      if (clauseWords.length === 0) continue;

      const fA = clamp(Math.floor(cStart / hopSec), 0, rms.length - 1);
      const fB = clamp(Math.ceil(cEnd / hopSec), fA + 1, rms.length);
      const wordSubThr = Math.max(0.008, noiseFloor * 2.55);
      const subIslandsRel = detectSegmentsWithMergeGap(
        rms.slice(fA, fB),
        hopSec,
        wordSubThr,
        0.065,
        0.04,
      );

      let wordBounds;
      if (
        subIslandsRel.length === clauseWords.length &&
        isExactIslandAlignmentProportional(subIslandsRel, clauseWords)
      ) {
        wordBounds = subIslandsRel.map((isl) => ({
          start: fA * hopSec + isl.start,
          end: fA * hopSec + isl.end,
          mode: "exact-island",
        }));
      } else {
        wordBounds = alignWordsWithDp(rms, hopSec, cStart, cEnd, clauseWords, wordSubThr);
      }

      for (let wi = 0; wi < clauseWords.length; wi++) {
        const wSpec = clauseWords[wi];
        const wb = wordBounds[wi];
        if (!wb || baseWordKeys.has(wSpec.key)) continue;
        if (!/^[a-z]+(?:-[a-z]+)*$/.test(wSpec.key)) continue;
        if (wSpec.key.length < 2 && !(wSpec.key === "a" && wb.mode === "exact-island")) continue;

        const isAtStart = wi === 0;
        const isAtEnd = wi === clauseWords.length - 1;
        if (
          wb.mode !== "exact-island" &&
          !isAtStart &&
          !isAtEnd &&
          clauseWords.length > 3 &&
          subIslandsRel.length < 2
        ) {
          continue;
        }

        const tightened = tightenSliceByRms(rms, hopSec, wb.start, wb.end, wordSubThr);
        const coreDur = tightened.activeEnd - tightened.activeStart;
        const sylEst = wSpec.key.match(/[aeiouy]+/g)?.length ?? 1;
        const minWordCoreDur = Math.max(HARVEST_MIN_DUR_SEC, Math.min(0.26, sylEst * 0.065));
        if (coreDur < minWordCoreDur || coreDur > HARVEST_MAX_DUR_SEC) continue;
        if (tightened.peakRms < Math.max(0.03, noiseFloor * 3.0)) continue;

        const edgeRatioLimit = wb.mode === "exact-island" ? 0.55 : 0.42;
        const leftOk = isAtStart || tightened.leftEdgeRms <= tightened.peakRms * edgeRatioLimit;
        const rightOk = isAtEnd || tightened.rightEdgeRms <= tightened.peakRms * edgeRatioLimit;
        if (!leftOk || !rightOk) continue;

        if (wSpec.key === "a") {
          const strictLeft = isAtStart || tightened.leftEdgeRms <= wordSubThr * 1.25;
          const strictRight = isAtEnd || tightened.rightEdgeRms <= wordSubThr * 1.25;
          if (!strictLeft || !strictRight) continue;
        }

        const prevWordEnd = wi > 0 ? wordBounds[wi - 1].end : Math.max(0, cStart - 0.1);
        const nextWordStart =
          wi + 1 < wordBounds.length ? wordBounds[wi + 1].start : Math.min(totalDurSec, cEnd + 0.1);

        const padStart = Math.max(
          prevWordEnd,
          tightened.activeStart - HARVEST_PRE_ROLL_SEC,
          (tightened.activeStart + prevWordEnd) * 0.5,
        );
        const padEnd = Math.min(
          nextWordStart,
          tightened.activeEnd + HARVEST_POST_ROLL_SEC,
          (tightened.activeEnd + nextWordStart) * 0.5,
        );
        const sliceDur = padEnd - padStart;
        if (sliceDur < HARVEST_MIN_DUR_SEC) continue;

        const score =
          (wb.mode === "exact-island" ? 10 : 0) +
          (1 - tightened.leftEdgeRms / Math.max(tightened.peakRms, 1e-4)) +
          (1 - tightened.rightEdgeRms / Math.max(tightened.peakRms, 1e-4)) +
          Math.min(1, coreDur / 0.35);

        const prevBest = bestCandidateByWord.get(wSpec.key);
        if (!prevBest || score > prevBest.score) {
          const s0 = clamp(Math.floor(padStart * sampleRate), 0, normalized.length - 1);
          const s1 = clamp(Math.ceil(padEnd * sampleRate), s0 + 1, normalized.length);
          const sliceSamples = normalized.slice(s0, s1);
          bestCandidateByWord.set(wSpec.key, {
            key: wSpec.key,
            samples: sliceSamples,
            sampleRate,
            activeRelStart: Math.max(0, tightened.activeStart - s0 / sampleRate),
            activeRelEnd: Math.min((s1 - s0) / sampleRate, tightened.activeEnd - s0 / sampleRate),
            mode: wb.mode,
            sourceClip: spec.id,
            score,
          });
        }
      }
    }

    clipsOut.push({
      id: spec.id,
      title: spec.title,
      src: `./audio/vox/clips/${encodedClip.outFileName}`,
      duration: roundTo(totalDurSec, 4),
      gain: 1.0,
      text: spec.speechLines.join(" "),
      clauses,
      outBytes: encodedClip.outBytes,
    });
  }

  // Assemble winning harvested words into komrad84_clips_harvest pack
  const harvestedList = Array.from(bestCandidateByWord.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  let harvestPack = null;
  const harvestedWordEntries = [];

  if (harvestedList.length > 0) {
    const gapSamples = Math.round(HARVEST_GAP_SEC * FALLBACK_SAMPLE_RATE);
    const fadeInSamples = Math.round(HARVEST_FADE_IN_SEC * FALLBACK_SAMPLE_RATE);
    const fadeOutSamples = Math.round(HARVEST_FADE_OUT_SEC * FALLBACK_SAMPLE_RATE);

    let totalHarvestSamples = gapSamples;
    for (const h of harvestedList) {
      totalHarvestSamples += h.samples.length + gapSamples;
    }

    const harvestBuf = new Float32Array(totalHarvestSamples);
    let cursor = gapSamples;

    for (const h of harvestedList) {
      const startSample = cursor;
      const len = h.samples.length;
      const activeRms = computeActiveRms(
        h.samples,
        h.sampleRate,
        h.activeRelStart,
        h.activeRelEnd,
      );
      const sliceGain = clamp(TARGET_ACTIVE_RMS / Math.max(activeRms, 1e-4), MIN_GAIN, MAX_GAIN);
      for (let i = 0; i < len; i++) {
        harvestBuf[startSample + i] = clamp(h.samples[i] * sliceGain, -0.98, 0.98);
      }
      applyCosineFades(
        harvestBuf,
        startSample,
        startSample + len,
        fadeInSamples,
        fadeOutSamples,
      );

      harvestedWordEntries.push({
        key: h.key,
        pack: HARVEST_PACK_ID,
        start: roundTo(startSample / FALLBACK_SAMPLE_RATE, 4),
        dur: roundTo(len / FALLBACK_SAMPLE_RATE, 4),
        gain: 1.0,
        mode: h.mode,
        sourceClip: h.sourceClip,
      });
      cursor += len + gapSamples;
    }

    const encodedHarvest = encodeSamplesToTarget(
      harvestBuf,
      FALLBACK_SAMPLE_RATE,
      VOX_OUT_DIR,
      HARVEST_PACK_ID,
      ffmpegAvailable,
    );
    harvestPack = {
      id: HARVEST_PACK_ID,
      src: `./audio/vox/${encodedHarvest.outFileName}`,
      outBytes: encodedHarvest.outBytes,
    };
  }

  return {
    clipsOut,
    harvestPack,
    harvestedWordEntries,
  };
}

function getVoxPackSortOrder(fileName) {
  const stem = fileName.replace(/\.(wav|ogg)$/i, "").toLowerCase();
  if (stem === "komrad84_vox_all") return 1;
  const m = stem.match(/^komrad84_vox(\d+)_all$/);
  if (m) return Number.parseInt(m[1], 10);
  return Number.MAX_SAFE_INTEGER;
}

function discoverWordPackFiles(allFiles, aiClipFileNames) {
  const byStem = new Map();
  for (const fileName of allFiles) {
    const lower = fileName.toLowerCase();
    if (aiClipFileNames.has(lower) || /^\d+_.*\.ogg$/i.test(fileName)) continue;
    if (!/(?:_all\.(?:wav|ogg)|\.wav)$/i.test(fileName)) continue;

    const stemKey = lower.replace(/\.(wav|ogg)$/, "");
    const existing = byStem.get(stemKey);
    // Prefer lossless .wav if both .wav and .ogg exist for the same stem
    if (!existing || (/\.ogg$/i.test(existing) && /\.wav$/i.test(fileName))) {
      byStem.set(stemKey, fileName);
    }
  }

  return Array.from(byStem.values()).sort((a, b) => {
    const orderDiff = getVoxPackSortOrder(a) - getVoxPackSortOrder(b);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b);
  });
}

function removeStaleHarvestFiles() {
  for (const ext of ["ogg", "wav"]) {
    const stalePath = path.join(VOX_OUT_DIR, `${HARVEST_PACK_ID}.${ext}`);
    if (fs.existsSync(stalePath)) {
      fs.unlinkSync(stalePath);
    }
  }
}

function main() {
  if (!fs.existsSync(VOX_SRC_DIR)) {
    console.error(`[VOX] Directory not found: ${VOX_SRC_DIR}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(VOX_SRC_DIR).sort((a, b) => a.localeCompare(b));
  const aiScriptsPath = path.join(VOX_SRC_DIR, AI_SCRIPTS_FILENAME);
  const aiScripts = fs.existsSync(aiScriptsPath) ? parseAiScriptsFile(aiScriptsPath) : [];
  const aiClipFileNames = new Set(aiScripts.map((s) => s.fileName.toLowerCase()));

  const packFiles = discoverWordPackFiles(allFiles, aiClipFileNames);
  const txtFiles = allFiles.filter(
    (f) =>
      /\.txt$/i.test(f) &&
      !IGNORED_TXT_FILES.has(f) &&
      !/_(?:report|batches)\.txt$/i.test(f),
  );

  if (packFiles.length === 0) {
    console.error(`[VOX] No *_all.(wav|ogg) or .wav word-pack files found in ${VOX_SRC_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(VOX_OUT_DIR, { recursive: true });
  const ffmpegAvailable = checkFfmpegAvailable();

  const manifest = {
    version: 2,
    packs: [],
    words: {},
    clips: [],
  };

  console.log("====================================================================");
  console.log("  K.O.M.R.A.D.-84 VOX WORD-SPRITE & CLIP BUILDER (SECTOR 84)");
  console.log("====================================================================");
  console.log(
    `Encoder: ${ffmpegAvailable ? "ffmpeg (libvorbis -q:a 4, 24kHz mono .ogg)" : "Node PCM fallback (24kHz mono 16-bit .wav)"}`,
  );

  const packSummaries = [];
  let totalExportBytes = 0;

  for (const packFile of packFiles) {
    const packStem = packFile.replace(/\.(wav|ogg)$/i, "");
    const labelFile = findMatchingLabelFile(packStem, txtFiles);
    if (!labelFile) {
      console.warn(`[VOX] Skipping ${packFile}: no matching label .txt file found.`);
      continue;
    }

    const res = processPack(packFile, labelFile, ffmpegAvailable);
    manifest.packs.push({ id: res.packId, src: res.src });

    for (const w of res.wordEntries) {
      if (!manifest.words[w.key]) {
        manifest.words[w.key] = {
          pack: w.pack,
          start: w.start,
          dur: w.dur,
          gain: w.gain,
        };
      }
    }
    packSummaries.push({ id: res.packId, words: res.wordEntries.length, outBytes: res.outBytes });
    totalExportBytes += res.outBytes;

    const sizeKB = (res.outBytes / 1024).toFixed(1);
    const sizeMB = (res.outBytes / (1024 * 1024)).toFixed(2);
    console.log("");
    console.log(`Pack: ${res.packId} (source: ${packFile}, labels: ${res.labelFile}, mode: ${res.labelMode})`);
    console.log(
      `Word count vs Detected segments: ${res.wordCount} vs ${res.detectedSegments} ${res.wordCount === res.detectedSegments ? "[MATCH]" : "[MISMATCH]"}`,
    );
    console.log(`Exported: ${res.src} (${sizeKB} KB / ${sizeMB} MB)`);

    const preview = [
      ...res.wordEntries.slice(0, 5).map((e, i) => ({ idx: i + 1, ...e })),
      ...res.wordEntries.slice(-5).map((e, i) => ({
        idx: res.wordEntries.length - 4 + i,
        ...e,
      })),
    ];
    console.log("First 5 & Last 5 Word Mappings:");
    console.table(
      preview.map((p) => ({
        "#": p.idx,
        word: p.key,
        start_s: p.start.toFixed(4),
        dur_s: p.dur.toFixed(4),
        rms_gain: p.gain.toFixed(3),
      })),
    );
  }

  if (manifest.packs.length === 0) {
    console.error(`[VOX] No valid word packs were processed in ${VOX_SRC_DIR}`);
    process.exit(1);
  }

  const baseWordKeys = new Set(Object.keys(manifest.words));
  let harvestedCount = 0;

  if (aiScripts.length > 0) {
    const { clipsOut, harvestPack, harvestedWordEntries } = processAiClipsAndHarvestWords(
      aiScripts,
      baseWordKeys,
      ffmpegAvailable,
    );

    for (const clip of clipsOut) {
      totalExportBytes += clip.outBytes;
      manifest.clips.push({
        id: clip.id,
        title: clip.title,
        src: clip.src,
        duration: clip.duration,
        gain: clip.gain,
        text: clip.text,
        clauses: clip.clauses,
      });
    }

    if (harvestPack) {
      totalExportBytes += harvestPack.outBytes;
      manifest.packs.push({ id: harvestPack.id, src: harvestPack.src });
      for (const hw of harvestedWordEntries) {
        if (!baseWordKeys.has(hw.key)) {
          manifest.words[hw.key] = {
            pack: hw.pack,
            start: hw.start,
            dur: hw.dur,
            gain: hw.gain,
          };
          harvestedCount += 1;
        }
      }
      console.log("");
      console.log(
        `Harvested Bonus Words (${harvestedCount} new isolated words -> ${harvestPack.src}, ${(harvestPack.outBytes / 1024).toFixed(1)} KB):`,
      );
      console.log(`  ${harvestedWordEntries.map((w) => `${w.key}[${w.dur.toFixed(2)}s/${w.mode}]`).join(", ")}`);
    } else {
      removeStaleHarvestFiles();
    }

    console.log("");
    console.log(`Registered Full Monologue Clips (${clipsOut.length}):`);
    console.table(
      clipsOut.map((c) => ({
        id: c.id,
        duration_s: c.duration.toFixed(2),
        clauses: c.clauses.length,
        size_kb: (c.outBytes / 1024).toFixed(1),
        src: c.src,
      })),
    );
  } else {
    removeStaleHarvestFiles();
    console.log(`[VOX] ${AI_SCRIPTS_FILENAME} not present; skipping clip export.`);
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const packSummaryStr = packSummaries.map((p) => `${p.id}=${p.words} words`).join(" | ");
  const totalSizeMB = (totalExportBytes / (1024 * 1024)).toFixed(2);
  console.log("");
  console.log(
    `Summary: ${packSummaryStr} | newly harvested=${harvestedCount} words | total=${Object.keys(manifest.words).length} words | clips=${manifest.clips.length} | exported audio=${totalSizeMB} MB`,
  );
  console.log(
    `Manifest written: ${path.relative(ROOT_DIR, MANIFEST_PATH)} (${manifest.packs.length} pack(s))`,
  );
}

main();
