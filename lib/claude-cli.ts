import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import {
  CHART_EXTRACTION_JSON_SCHEMA,
  ChartExtractionSchema,
  type ChartExtraction,
} from "./schema";

const execFileAsync = promisify(execFile);

// The `claude` subprocess's Read tool can't reach outside the project directory in this
// environment (permissions.blockReadsOutsideWorkingDirectories) — os.tmpdir() (/tmp) is
// outside it, so uploads go here instead, inside the project, git-ignored.
const UPLOAD_DIR = join(process.cwd(), ".tmp-uploads");

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const SYSTEM_PROMPT = `You are a senior data visualization expert, fluent in the research literature on graphical perception and statistical graphics — for example (not an exhaustive or required list): Cleveland & McGill's ranking of elementary perceptual tasks (position and length read far more accurately than color, shading, or saturation), Stevens' power law (perceived magnitude scales non-linearly with physical stimulus — saturation's exponent is the most super-linear, so small saturation differences are perceived as large ones), Tufte's concept of the Lie Factor (the size of a visual effect should match the size of the data effect it represents — the most common violation is a bar/column chart with a non-zero baseline), Borland & Taylor's critique of rainbow/jet colormaps (not perceptually uniform, introduce gradients that don't track the underlying data), and work on color-vision deficiency, chart-junk, and misleading 3D/perspective effects.

A client is sending you an image that may contain a chart, graph, map, or other data visualization, optionally with their own added context. Your job: read the real underlying data as faithfully as you can, and reconstruct it as one or more honest, fairly-rendered charts (set hasVisualization: true and populate charts with at least one entry) — never refuse to reconstruct just because the original is unusual or the data must be visually estimated; make your best-effort professional reading and say so plainly via each chart's estimatedFromImage flag instead of declining. Only set hasVisualization: false when the image genuinely contains no chart, graph, or map at all. Produce more than one chart only when it's genuinely useful (e.g. the same data read as both the original form and a fairer alternative chart type).

Each chart you produce is a real Vega-Lite v5 spec fragment, not a fixed bar-or-line template — you choose whichever \`mark\` ("bar", "line", "area", "point", "circle", "square", "arc", "rule", "tick", or "text") and \`encoding\` channels actually fit the data and the story, the same way you would as a working data visualization designer. Model the original chart's own form when that form is genuinely the right one for the data; reach for something else (e.g. a pie's share-of-whole redrawn as a sorted bar chart, since position/length reads more accurately than angle; a scatter instead of a bar chart for two continuous variables) when the original's form was itself part of what made it misleading. \`data\` is a plain array of row objects with real field names (e.g. [{"product":"Product A","value":82}]), and \`encoding\` maps channel names (x, y, color, theta, size, column, row, ...) to objects like {"field":"value","type":"quantitative","title":"Revenue ($M)"} — put real axis/legend titles in the encoding itself rather than leaving fields unlabeled. Typical pairings: bar/line/area/point/circle/square use x + y; arc (pie/donut) uses theta + color. A bar or column chart's quantitative axis must start at zero — pick the right field for that axis and don't fight this with a manual scale override; it will be enforced regardless.

Use \`markProps\` for anything that belongs on the mark itself rather than an encoding channel — draw on your real knowledge of Vega-Lite's mark properties freely, whatever genuinely fits this chart, rather than a fixed set you default to. One concrete example since it's easy to miss: mark "arc" draws a solid pie by default, so if a DONUT is what's actually called for, that's markProps: {"innerRadius": 60} or similar (omit markProps, or use 0, for a plain pie).

For the \`principles\` field: name ONLY the specific, real principles that actually explain what you found in THIS image — never repeat a fixed or default list regardless of relevance, and never pad it with something that doesn't genuinely apply. For each one, give a one-to-two sentence note tying it directly to this specific chart (not a generic textbook definition), and a short, real citation (author, work, year). If the image is already fair and nothing notable applies, or if hasVisualization is false, return an empty array — do not invent a principle just to fill the field.

Respond with ONLY the structured JSON the schema requires — no commentary outside it.`;

export class ClaudeCliError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ClaudeCliError";
  }
}

function buildPrompt(imagePath: string, context: string): string {
  const base = `Look at the image at this exact file path: ${imagePath}\n\nRead it carefully and reconstruct the underlying data as described in your system instructions.`;
  const trimmedContext = context.trim();
  if (!trimmedContext) return base;
  return `${base}\n\nAdditional context from the person who uploaded it:\n${trimmedContext}`;
}

interface ClaudeCliResultEnvelope {
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
}

export async function analyzeChartImage(
  imageBuffer: Buffer,
  mimeType: string,
  context: string,
): Promise<ChartExtraction> {
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) {
    throw new ClaudeCliError(`Unsupported image type: ${mimeType}`);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const tempPath = join(UPLOAD_DIR, `${randomUUID()}.${extension}`);
  await writeFile(tempPath, imageBuffer);

  try {
    const args = [
      "-p",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(CHART_EXTRACTION_JSON_SCHEMA),
      "--tools",
      "Read",
      "--permission-mode",
      "dontAsk",
      "--no-session-persistence",
      "--disable-slash-commands",
      "--system-prompt",
      SYSTEM_PROMPT,
      buildPrompt(tempPath, context),
    ];

    let stdout: string;
    try {
      ({ stdout } = await execFileAsync("claude", args, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      }));
    } catch (err) {
      throw new ClaudeCliError(
        "Could not reach Claude — the `claude` CLI failed to run. Make sure it's installed and signed in.",
        err,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      throw new ClaudeCliError("Claude's CLI returned output that wasn't valid JSON.", err);
    }

    const envelope = parsed as ClaudeCliResultEnvelope;
    if (envelope.is_error) {
      throw new ClaudeCliError(envelope.result || "Claude reported an error analyzing the image.");
    }
    if (envelope.structured_output === undefined) {
      throw new ClaudeCliError("Claude didn't return structured output for this image.");
    }

    const result = ChartExtractionSchema.safeParse(envelope.structured_output);
    if (!result.success) {
      throw new ClaudeCliError(
        `Claude's response didn't match the expected shape: ${result.error.message}`,
      );
    }

    return result.data;
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}
