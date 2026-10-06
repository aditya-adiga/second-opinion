import { z } from "zod";

/**
 * Valid Vega-Lite mark types this app will render. Not a "pick one of two" restriction like
 * the old bar/line-only version — this is the real set of chart forms Vega-Lite supports, and
 * Claude picks freely among them (plus whatever encoding channels suit the data) rather than
 * being steered toward a fixed shape.
 */
export const CHART_MARKS = [
  "bar",
  "line",
  "area",
  "point",
  "circle",
  "square",
  "arc",
  "rule",
  "tick",
  "text",
] as const;

const DataRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const ChartSpecSchema = z.object({
  mark: z.enum(CHART_MARKS),
  // Extra Vega-Lite mark-level properties beyond just the mark type — whatever the chart
  // actually calls for (e.g. {innerRadius: 60} is what turns an "arc" into a donut rather
  // than a solid pie). Not a fixed list to pick from; optional, omit for a plain mark.
  markProps: z.record(z.string(), z.unknown()).optional(),
  title: z.string(),
  // Inline tabular data: each row's keys are the field names referenced by `encoding` — e.g.
  // [{"product": "A", "value": 82}, {"product": "B", "value": 100}]. Not constrained to a
  // fixed "categories + series" shape, so Claude can model whatever fields the chart needs.
  data: z.array(DataRowSchema).min(1),
  // Vega-Lite encoding channels (x, y, color, theta, size, ...), each a channel definition
  // object ({field, type, ...}) — or, for channels like tooltip/order/detail that Vega-Lite
  // allows to carry several fields at once, an array of such objects. Left loosely typed
  // rather than fully modeled — Vega-Lite's own encoding grammar is large, and the renderer
  // validates/reports errors at draw time.
  encoding: z.record(
    z.string(),
    z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]),
  ),
  estimatedFromImage: z.boolean(),
  issues: z.array(z.string()),
  caption: z.string(),
});

export const PrincipleRefSchema = z.object({
  name: z.string(),
  note: z.string(),
  reference: z.string(),
});

export const ChartExtractionSchema = z.object({
  hasVisualization: z.boolean(),
  note: z.string(),
  summary: z.string(),
  charts: z.array(ChartSpecSchema),
  principles: z.array(PrincipleRefSchema),
});

export type ChartSpec = z.infer<typeof ChartSpecSchema>;
export type PrincipleRef = z.infer<typeof PrincipleRefSchema>;
export type ChartExtraction = z.infer<typeof ChartExtractionSchema>;

/**
 * Hand-written mirror of ChartExtractionSchema, in raw JSON Schema (not Zod) — this is what
 * gets passed to the `claude` CLI's `--json-schema` flag, so the CLI constrains its own output
 * to this shape before it ever reaches the Zod parse in lib/claude-cli.ts. `encoding` is left
 * loosely typed on purpose (object, additionalProperties: true) — trying to fully describe
 * Vega-Lite's encoding grammar here would fight the point of letting Claude choose it freely.
 */
export const CHART_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    hasVisualization: {
      type: "boolean",
      description: "false only if the image contains no chart, graph, or map at all.",
    },
    note: {
      type: "string",
      description: "Explanation when hasVisualization is false; a short caveat otherwise.",
    },
    summary: {
      type: "string",
      description: "2-4 sentence overall narrative of what was found.",
    },
    charts: {
      type: "array",
      description: "One entry minimum whenever hasVisualization is true.",
      items: {
        type: "object",
        properties: {
          mark: { type: "string", enum: [...CHART_MARKS] },
          markProps: {
            type: "object",
            description:
              'Optional extra Vega-Lite mark-level properties beyond the mark type itself — any that genuinely fit, not a fixed set. For example, mark "arc" draws a solid pie by default; {"innerRadius": 60} is what makes it a donut instead. Omit entirely for a plain mark.',
            additionalProperties: true,
          },
          title: { type: "string" },
          data: {
            type: "array",
            minItems: 1,
            description:
              'Inline data rows, e.g. [{"product":"Product A","value":82},{"product":"Product B","value":100}]. Use real field names that encoding refers to, not generic "x"/"y".',
            items: {
              type: "object",
              additionalProperties: { type: ["string", "number", "boolean", "null"] },
            },
          },
          encoding: {
            type: "object",
            description:
              'Vega-Lite encoding channels such as x, y, color, theta, size — whichever suit the chosen mark. Each channel is normally an object like {"field":"value","type":"quantitative","title":"Revenue ($M)"} — except tooltip/order/detail, which may instead be an array of such objects when you want more than one field on that channel. Bar/line/area/point typically use x+y; arc (pie/donut) typically uses theta+color.',
            additionalProperties: true,
          },
          estimatedFromImage: {
            type: "boolean",
            description: "true if values are a best-effort visual estimate, not printed numbers.",
          },
          issues: {
            type: "array",
            items: { type: "string" },
            description: 'Concrete things found, e.g. "y-axis starts at 70, not 0".',
          },
          caption: {
            type: "string",
            description: "1-2 sentences: why this reconstruction, what it fixes.",
          },
        },
        required: ["mark", "title", "data", "encoding", "estimatedFromImage", "issues", "caption"],
      },
    },
    principles: {
      type: "array",
      description:
        "Only the recognized data-visualization / graphical-perception principles actually relevant to what you found in THIS image — not a fixed list repeated every time. Empty array if the image was fair and nothing of note applied, or if hasVisualization is false.",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              'Short name, e.g. "Tufte\'s Lie Factor" or "Cleveland & McGill\'s ranking of elementary perceptual tasks".',
          },
          note: {
            type: "string",
            description: "1-2 sentences: how this specific principle applies to what you found here.",
          },
          reference: {
            type: "string",
            description: "A real, short citation for the source, e.g. author, work, year.",
          },
        },
        required: ["name", "note", "reference"],
      },
    },
  },
  required: ["hasVisualization", "note", "summary", "charts", "principles"],
} as const;
