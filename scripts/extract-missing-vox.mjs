// K.O.M.R.A.D.-84 Repository-Wide Dialogue Extractor & Missing VOX Batch Generator (Sector 84)
// Scans src/ (read-only) for every K.O.M.R.A.D.-84 terminal, dispatch, tutorial, and alert line,
// expands tokens using komradVoiceSynth.ts rules (without stem hiding), diffs against
// public/audio/vox/komrad_vox_manifest.json, and writes:
//   - vox/found_komrad_lines_report.txt
//   - vox/missing_vox_tts_batches.txt
//   - vox/komrad84_vox_extra_labels.txt

import fs from "node:fs";
import path from "node:path";
import { parseAst, transformWithOxc } from "vite";

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");
const VOX_DIR = path.join(ROOT_DIR, "vox");
const MANIFEST_PATH = path.join(ROOT_DIR, "public", "audio", "vox", "komrad_vox_manifest.json");
const VOICE_SYNTH_PATH = path.join(SRC_DIR, "shared", "komradVoiceSynth.ts");

const REPORT_OUT_PATH = path.join(VOX_DIR, "found_komrad_lines_report.txt");
const BATCHES_OUT_PATH = path.join(VOX_DIR, "missing_vox_tts_batches.txt");
const LABELS_OUT_PATH = path.join(VOX_DIR, "komrad84_vox_extra_labels.txt");

const BATCH_SIZE = 28;
const BOUND_PREFIX_WORD_RE = /\b(?:re|pre|un|non|bio|inter|micro)-[a-z]+\b/gi;
const SKIP_ARTIFACT_TOKENS = new Set(["dd", "performom"]);
const UPPER_ACRONYMS = new Set([
  "ai",
  "avr",
  "bru",
  "cia",
  "crt",
  "hepa",
  "hz",
  "mcr",
  "ok",
  "psi",
  "rbmk",
  "rpm",
  "suz",
  "tass",
  "tvs",
  "ussr",
  "uv",
  "vfd",
]);

function normalizeWordKey(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function listSourceFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function loadStrictTokenizer() {
  const voiceSrc = fs.readFileSync(VOICE_SYNTH_PATH, "utf8");
  const { code } = await transformWithOxc(voiceSrc, VOICE_SYNTH_PATH, { lang: "ts" });
  const cjs = code
    .replace(/^import\s+[\s\S]*?from\s+["']([^"']+)["'];?/gm, (match, spec) => {
      if (match.includes("import type")) return "";
      const named = match.match(/\{([\s\S]*?)\}/);
      if (named) {
        const cleaned = named[1]
          .replace(/\btype\s+\w+/g, "")
          .replace(/\s+as\s+/g, ": ")
          .replace(/,\s*,/g, ",");
        return `const {${cleaned}} = __req(${JSON.stringify(spec)});`;
      }
      return "";
    })
    .replace(/^export\s+(?:async\s+)?function\s+(\w+)/gm, "exports.$1 = function $1")
    .replace(/^export\s+const\s+(\w+)\s*=/gm, "exports.$1 =")
    // Require exact key presence rather than morphological stem fallback
    .replace(
      /function findMorphMatch\([\s\S]*?\n\}/,
      "function findMorphMatch(key, words) { return key && words[key] ? key : null; }",
    );

  const modExports = {};
  const fn = new Function("exports", "__req", cjs);
  fn(modExports, () => ({
    getAudioContext: () => null,
    useGameStore: { getState: () => ({}), setState: () => {} },
  }));
  return modExports.tokenizeToVoxQueue;
}

async function parseFileAst(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const lang = filePath.endsWith(".tsx") ? "tsx" : "ts";
  const { code } = await transformWithOxc(src, filePath, { lang });
  return parseAst(code);
}

function walkAst(node, visitor) {
  if (!node || typeof node !== "object") return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) walkAst(item, visitor);
    } else if (child && typeof child.type === "string") {
      walkAst(child, visitor);
    }
  }
}

function getPropertyKeyName(prop) {
  if (!prop || !prop.key) return "";
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal") return String(prop.key.value);
  return "";
}

function resolveTemplateExpr(expr, env) {
  if (!expr) return ["42"];
  if (expr.type === "Literal") return [String(expr.value)];
  if (expr.type === "ConditionalExpression") {
    const branches = [];
    if (expr.consequent.type === "Literal" && typeof expr.consequent.value === "string") {
      branches.push(expr.consequent.value);
    }
    if (expr.alternate.type === "Literal" && typeof expr.alternate.value === "string") {
      branches.push(expr.alternate.value);
    }
    if (branches.length > 0) return branches;
  }
  if (expr.type === "Identifier" && env.has(expr.name)) {
    const vals = env.get(expr.name);
    if (vals.length > 0 && vals.length <= 8) return vals;
  }
  return ["42"];
}

function extractStringsFromNode(node, out, env = new Map()) {
  if (!node || typeof node !== "object") return;

  if (node.type === "Literal" && typeof node.value === "string") {
    out.push(node.value);
    return;
  }

  if (node.type === "TemplateLiteral") {
    let variants = [""];
    for (let i = 0; i < node.quasis.length; i++) {
      const cooked = node.quasis[i].value.cooked ?? node.quasis[i].value.raw ?? "";
      variants = variants.map((v) => v + cooked);
      if (i < node.expressions.length) {
        const choices = resolveTemplateExpr(node.expressions[i], env);
        const next = [];
        for (const base of variants) {
          for (const choice of choices) {
            next.push(base + choice);
          }
        }
        variants = next.slice(0, 16);
      }
    }
    for (const v of variants) out.push(v);
    return;
  }

  if (node.type === "ConditionalExpression") {
    extractStringsFromNode(node.consequent, out, env);
    extractStringsFromNode(node.alternate, out, env);
    return;
  }

  if (node.type === "LogicalExpression") {
    extractStringsFromNode(node.left, out, env);
    extractStringsFromNode(node.right, out, env);
    return;
  }

  if (node.type === "Identifier" && env.has(node.name)) {
    for (const v of env.get(node.name)) out.push(v);
    return;
  }

  if (node.type === "ArrayExpression") {
    for (const el of node.elements) extractStringsFromNode(el, out, env);
    return;
  }

  if (node.type === "ObjectExpression") {
    for (const prop of node.properties) {
      if (prop.type === "Property") {
        extractStringsFromNode(prop.value, out, env);
      }
    }
    return;
  }

  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    extractStringsFromNode(node.body, out, env);
    return;
  }

  if (node.type === "BlockStatement") {
    for (const stmt of node.body) {
      if (stmt.type === "ReturnStatement") {
        extractStringsFromNode(stmt.argument, out, env);
      }
    }
  }
}

function collectFunctionScopeLines(fnNode, targetLines) {
  const env = new Map();
  walkAst(fnNode, (n) => {
    if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.init) {
      const vals = [];
      extractStringsFromNode(n.init, vals, env);
      if (vals.length > 0) {
        env.set(n.id.name, vals);
      }
    } else if (n.type === "AssignmentExpression" && n.left?.type === "Identifier") {
      const vals = [];
      extractStringsFromNode(n.right, vals, env);
      if (vals.length > 0) {
        env.set(n.left.name, [...(env.get(n.left.name) ?? []), ...vals]);
      }
    }
  });

  walkAst(fnNode, (n) => {
    if (n.type !== "CallExpression" || n.callee?.type !== "Identifier") return;
    const calleeName = n.callee.name;
    if (calleeName === "createKomradMsg" && n.arguments[1]) {
      extractStringsFromNode(n.arguments[1], targetLines, env);
    } else if (calleeName === "createLogEntry" && n.arguments[2]) {
      extractStringsFromNode(n.arguments[2], targetLines, env);
    } else if (calleeName === "pushKomradLiveDispatch") {
      if (n.arguments[0]) extractStringsFromNode(n.arguments[0], targetLines, env);
      if (n.arguments[3]) extractStringsFromNode(n.arguments[3], targetLines, env);
    } else if (calleeName === "pushWallKomrad" && n.arguments[0]) {
      extractStringsFromNode(n.arguments[0], targetLines, env);
    }
  });
}

function isUsefulDialogueLine(raw) {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length < 6) return false;
  if (/^[╔╗╚╝╠╣═║•│─]+/.test(clean)) return false;
  if (!/[A-Za-z]{2,}/.test(clean)) return false;
  return true;
}

async function extractAllRepoKomradLines() {
  const files = listSourceFiles(SRC_DIR);
  const byFile = new Map();

  const recordLines = (absPath, rawLines) => {
    const rel = path.relative(ROOT_DIR, absPath).replace(/\\/g, "/");
    if (!byFile.has(rel)) byFile.set(rel, new Set());
    const set = byFile.get(rel);
    for (const line of rawLines) {
      const clean = line.replace(/\s+/g, " ").trim();
      if (isUsefulDialogueLine(clean)) {
        set.add(clean);
      }
    }
    if (set.size === 0) byFile.delete(rel);
  };

  for (const filePath of files) {
    const rel = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
    const ast = await parseFileAst(filePath);
    const extracted = [];

    if (rel === "src/shared/komradLiveDispatches.ts") {
      walkAst(ast, (n) => {
        if (
          n.type === "VariableDeclarator" &&
          n.id?.type === "Identifier" &&
          /MESSAGE|QUOTES/.test(n.id.name)
        ) {
          extractStringsFromNode(n.init, extracted);
        }
      });
    } else if (rel === "src/modules/terminal/komradScript.ts") {
      walkAst(ast, (n) => {
        if (
          n.type === "VariableDeclarator" &&
          n.id?.type === "Identifier" &&
          (n.id.name === "KOMRAD_MANUSCRIPT" || n.id.name === "HOURLY_SHIFT_BROADCASTS")
        ) {
          extractStringsFromNode(n.init, extracted);
        }
      });
    } else if (rel === "src/shared/useGameStore.ts") {
      walkAst(ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.type === "Identifier") {
          if (/^KOMRAD_/.test(n.id.name)) {
            extractStringsFromNode(n.init, extracted);
          } else if (n.id.name === "DIRECTIVE_BLUEPRINTS" && n.init?.type === "ArrayExpression") {
            for (const el of n.init.elements) {
              if (el?.type === "ObjectExpression") {
                for (const prop of el.properties) {
                  if (prop.type === "Property" && getPropertyKeyName(prop) === "title") {
                    extractStringsFromNode(prop.value, extracted);
                  }
                }
              }
            }
          } else if (n.id.name === "INITIAL_ENTRIES" && n.init) {
            collectFunctionScopeLines(n.init, extracted);
          }
        } else if (
          n.type === "FunctionDeclaration" &&
          (n.id?.name === "getContextualDiagnosticHint" || n.id?.name === "evaluateWheelFreeTutorial")
        ) {
          walkAst(n, (sub) => {
            if (sub.type === "ReturnStatement") {
              extractStringsFromNode(sub.argument, extracted);
            }
          });
        } else if (
          n.type === "Property" &&
          (n.value?.type === "ArrowFunctionExpression" || n.value?.type === "FunctionExpression")
        ) {
          collectFunctionScopeLines(n.value, extracted);
        }
      });
    } else if (rel === "src/simulation/rbmkPhysics.ts") {
      walkAst(ast, (n) => {
        if (n.type === "FunctionDeclaration" && n.id?.name === "evaluateTutorial") {
          const env = new Map();
          walkAst(n, (sub) => {
            if (sub.type === "VariableDeclarator" && sub.id?.type === "Identifier" && sub.init) {
              const vals = [];
              extractStringsFromNode(sub.init, vals, env);
              if (vals.length > 0) env.set(sub.id.name, vals);
            }
          });
          const promptFields = new Set(["header", "body", "hint", "actionLine", "whyLines", "volkovQuote"]);
          walkAst(n, (sub) => {
            if (sub.type === "Property" && promptFields.has(getPropertyKeyName(sub))) {
              extractStringsFromNode(sub.value, extracted, env);
            }
          });
        }
      });
    } else if (rel === "src/modules/inspector/useDeskStore.ts") {
      walkAst(ast, (n) => {
        if (
          n.type === "VariableDeclarator" &&
          n.id?.type === "Identifier" &&
          n.id.name === "SECTOR_ORDER_SPECS"
        ) {
          walkAst(n.init, (sub) => {
            if (sub.type === "Property" && getPropertyKeyName(sub) === "ruTopic") {
              extractStringsFromNode(sub.value, extracted);
            }
          });
        } else if (
          n.type === "VariableDeclarator" &&
          n.id?.type === "Identifier" &&
          n.id.name === "SINGLE_TARGET_BLUEPRINTS"
        ) {
          walkAst(n.init, (sub) => {
            if (sub.type === "Property" && getPropertyKeyName(sub) === "titlePrefix") {
              extractStringsFromNode(sub.value, extracted);
            }
          });
        } else if (
          n.type === "Property" &&
          getPropertyKeyName(n) === "title" &&
          n.value?.type === "Literal" &&
          typeof n.value.value === "string" &&
          /DRILL ORDER/i.test(n.value.value)
        ) {
          extracted.push(n.value.value);
        }
      });
    } else {
      // Generic sweep for any future files pushing Komrad messages or terminal entries
      walkAst(ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.type === "Identifier") {
          const nm = n.callee.name;
          if (nm === "createKomradMsg" && n.arguments[1]) {
            extractStringsFromNode(n.arguments[1], extracted);
          } else if (nm === "createLogEntry" && n.arguments[2]) {
            extractStringsFromNode(n.arguments[2], extracted);
          } else if (nm === "pushKomradLiveDispatch") {
            if (n.arguments[0]) extractStringsFromNode(n.arguments[0], extracted);
            if (n.arguments[3]) extractStringsFromNode(n.arguments[3], extracted);
          } else if (nm === "pushWallKomrad" && n.arguments[0]) {
            extractStringsFromNode(n.arguments[0], extracted);
          }
        } else if (
          n.type === "Property" &&
          getPropertyKeyName(n) === "komradMessages" &&
          n.value?.type === "ArrayExpression"
        ) {
          walkAst(n.value, (sub) => {
            if (sub.type === "Property" && getPropertyKeyName(sub) === "text") {
              extractStringsFromNode(sub.value, extracted);
            }
          });
        }
      });
    }

    if (extracted.length > 0) {
      recordLines(filePath, extracted);
    }
  }

  return byFile;
}

function formatTtsWord(key) {
  if (UPPER_ACRONYMS.has(key)) {
    return `${key.toUpperCase()}.`;
  }
  if (key === "oclock") {
    return "O'clock.";
  }
  if (key.includes("-")) {
    const parts = key.split("-");
    const formatted = `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}-${parts.slice(1).join("-")}`;
    return `${formatted}.`;
  }
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}.`;
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[VOX EXTRACT] Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const exactManifestWords = new Set(Object.keys(manifest.words ?? {}));
  const tokenizeToVoxQueue = await loadStrictTokenizer();
  const byFile = await extractAllRepoKomradLines();

  // Pre-seed bound-prefix hyphenated words so tokenizeToVoxQueue keeps them whole instead of splitting "re-" / "un-" / "pre-"
  const tokenizerWords = { ...manifest.words };
  for (const lineSet of byFile.values()) {
    for (const line of lineSet) {
      for (const m of line.matchAll(BOUND_PREFIX_WORD_RE)) {
        const key = normalizeWordKey(m[0]);
        if (key && !tokenizerWords[key]) {
          tokenizerWords[key] = { pack: "__bound_prefix__", start: 0, dur: 0.2, gain: 1 };
        }
      }
    }
  }

  const allUniqueWords = new Set();
  const recordedWords = new Set();
  const missingWeightedCounts = new Map();
  const missingRawCounts = new Map();

  let totalLines = 0;
  for (const [relFile, lineSet] of byFile.entries()) {
    totalLines += lineSet.size;
    const isLiveCoreFile =
      relFile === "src/shared/useGameStore.ts" ||
      relFile === "src/shared/komradLiveDispatches.ts";
    const weight = isLiveCoreFile ? 2 : 1;

    for (const line of lineSet) {
      const queue = tokenizeToVoxQueue(line, tokenizerWords);
      for (const item of queue) {
        if (item.kind === "pause") continue;
        const rawTok = item.kind === "word" ? item.word : item.rawWord;
        const key = normalizeWordKey(rawTok);
        if (!key || /^\d+$/.test(key) || SKIP_ARTIFACT_TOKENS.has(key)) continue;

        allUniqueWords.add(key);
        if (exactManifestWords.has(key)) {
          recordedWords.add(key);
        } else {
          missingWeightedCounts.set(key, (missingWeightedCounts.get(key) ?? 0) + weight);
          missingRawCounts.set(key, (missingRawCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  const sortedMissing = Array.from(missingWeightedCounts.keys()).sort((a, b) => {
    const wDiff = (missingWeightedCounts.get(b) ?? 0) - (missingWeightedCounts.get(a) ?? 0);
    if (wDiff !== 0) return wDiff;
    const cDiff = (missingRawCounts.get(b) ?? 0) - (missingRawCounts.get(a) ?? 0);
    if (cDiff !== 0) return cDiff;
    return a.localeCompare(b);
  });

  // 1. Write vox/found_komrad_lines_report.txt
  fs.mkdirSync(VOX_DIR, { recursive: true });
  const reportLines = [
    "====================================================================",
    "  K.O.M.R.A.D.-84 EXTRACTED DIALOGUE & DISPATCH REPORT (SECTOR 84)",
    "====================================================================",
    `Source files scanned with lines : ${byFile.size}`,
    `Total deduplicated lines found  : ${totalLines}`,
    `Total unique expanded words     : ${allUniqueWords.size}`,
    `Already recorded in manifest    : ${recordedWords.size} (manifest total=${exactManifestWords.size})`,
    `Missing words to record         : ${sortedMissing.length}`,
    "",
  ];

  for (const [relFile, lineSet] of byFile.entries()) {
    reportLines.push(`=== ${relFile} (${lineSet.size} lines) ===`);
    let idx = 1;
    for (const line of lineSet) {
      reportLines.push(`  ${String(idx).padStart(3, " ")}. ${line}`);
      idx += 1;
    }
    reportLines.push("");
  }
  fs.writeFileSync(REPORT_OUT_PATH, `${reportLines.join("\n")}\n`, "utf8");

  // 2. Write vox/missing_vox_tts_batches.txt & vox/komrad84_vox_extra_labels.txt (strict 1:1 order)
  const batchLines = [
    `# K.O.M.R.A.D.-84 MISSING VOX TTS BATCHES (${sortedMissing.length} words, ${BATCH_SIZE} per batch)`,
    "# Copy-paste each batch into your TTS generator, save combined audio as vox/komrad84_vox_extra.wav,",
    "# and run `npm run build:vox` to slice & merge using vox/komrad84_vox_extra_labels.txt.",
    "",
  ];
  const labelLines = [];
  let batchCount = 0;

  for (let i = 0; i < sortedMissing.length; i += BATCH_SIZE) {
    batchCount += 1;
    const slice = sortedMissing.slice(i, i + BATCH_SIZE);
    const startNum = i + 1;
    const endNum = i + slice.length;
    batchLines.push(
      `=== BATCH ${String(batchCount).padStart(2, "0")} (${slice.length} words: #${startNum}-#${endNum}) ===`,
    );
    batchLines.push(slice.map((key) => formatTtsWord(key)).join(" "));
    batchLines.push("");
    for (const key of slice) {
      labelLines.push(key);
    }
  }

  // Verify strict 1:1 parity before writing
  const ttsTokensCount = batchLines
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("==="))
    .flatMap((l) => l.split(/\s+/).filter(Boolean)).length;
  if (ttsTokensCount !== labelLines.length || labelLines.length !== sortedMissing.length) {
    throw new Error(
      `Parity mismatch: ttsTokens=${ttsTokensCount}, labels=${labelLines.length}, missing=${sortedMissing.length}`,
    );
  }

  fs.writeFileSync(BATCHES_OUT_PATH, `${batchLines.join("\n")}\n`, "utf8");
  fs.writeFileSync(LABELS_OUT_PATH, `${labelLines.join("\n")}\n`, "utf8");

  // Print verification summary
  console.log("====================================================================");
  console.log("  K.O.M.R.A.D.-84 MISSING VOX EXTRACTION COMPLETE (SECTOR 84)");
  console.log("====================================================================");
  console.log("Source files with K.O.M.R.A.D.-84 lines:");
  for (const [relFile, lineSet] of byFile.entries()) {
    console.log(`  - ${relFile} (${lineSet.size} lines)`);
  }
  console.log(`Total lines extracted     : ${totalLines}`);
  console.log(`Total unique words        : ${allUniqueWords.size}`);
  console.log(`Already recorded words    : ${recordedWords.size} (manifest=${exactManifestWords.size})`);
  console.log(`Missing words extracted   : ${sortedMissing.length} (${batchCount} TTS batches of <=${BATCH_SIZE})`);
  console.log("Generated files:");
  console.log(`  - ${path.relative(ROOT_DIR, REPORT_OUT_PATH)}`);
  console.log(`  - ${path.relative(ROOT_DIR, BATCHES_OUT_PATH)}`);
  console.log(`  - ${path.relative(ROOT_DIR, LABELS_OUT_PATH)}`);
}

await main();
