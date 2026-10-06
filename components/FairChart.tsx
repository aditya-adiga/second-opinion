"use client";

import { useEffect, useRef, useState } from "react";
import embed from "vega-embed";
import type { Result } from "vega-embed";

import type { ChartSpec } from "@/lib/schema";

// Validated categorical palette (fixed order, never cycled) carried over from the earlier
// dataviz pass on this project.
const CATEGORY_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

const INK = "#2e2b24";
const INK_SOFT = "#6c6354";
const MUTED = "#8a8068";
const LINE = "#e6ddc9";

/**
 * Claude's `encoding` is free-form (any Vega-Lite channels it chooses), but a bar/column
 * chart's quantitative axis must still start at zero regardless of what it asked for — this
 * is enforced here, in the renderer, rather than trusted to the prompt alone.
 */
function withHonestScales(chart: ChartSpec): Record<string, unknown> {
  const encoding = structuredClone(chart.encoding) as Record<string, Record<string, unknown>>;
  if (chart.mark === "bar") {
    for (const channel of ["x", "y"]) {
      const def = encoding[channel];
      if (def && def.type === "quantitative") {
        const scale = (def.scale as Record<string, unknown>) ?? {};
        encoding[channel] = { ...def, scale: { ...scale, zero: true } };
      }
    }
  }
  return encoding;
}

export default function FairChart({ chart }: { chart: ChartSpec }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let view: Result["view"] | undefined;
    setRenderError(null);

    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container",
      height: 260,
      autosize: { type: "fit", contains: "padding" },
      background: "transparent",
      title: { text: chart.title, color: INK, fontSize: 14, fontWeight: 600 },
      data: { values: chart.data },
      mark: { type: chart.mark, tooltip: true, ...chart.markProps },
      encoding: withHonestScales(chart),
      config: {
        font: "system-ui, sans-serif",
        axis: {
          labelColor: MUTED,
          titleColor: INK_SOFT,
          gridColor: LINE,
          domainColor: MUTED,
          tickColor: MUTED,
          labelFontSize: 10,
          titleFontSize: 10,
        },
        legend: { labelColor: INK_SOFT, titleColor: INK_SOFT, labelFontSize: 10, titleFontSize: 10 },
        range: { category: CATEGORY_COLORS },
        mark: { color: CATEGORY_COLORS[0] },
        arc: { fill: CATEGORY_COLORS[0] },
        view: { stroke: "transparent" },
      },
    };

    embed(container, spec as Parameters<typeof embed>[1], { actions: false, renderer: "svg" })
      .then((result) => {
        if (cancelled) {
          result.view.finalize();
          return;
        }
        view = result.view;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "Couldn't render this chart.");
        }
      });

    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [chart]);

  if (renderError) {
    return (
      <p className="text-sm text-rose px-2 py-1">
        Couldn&rsquo;t render this chart: {renderError}
      </p>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
