"use client";

import { useRef, useState } from "react";

import FairChart from "@/components/FairChart";
import type { ChartExtraction } from "@/lib/schema";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChartExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("context", context);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong analyzing the image.");
        return;
      }

      setResult(data as ChartExtraction);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(selected: File | null) {
    setFile(selected);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileChange(dropped);
  }

  return (
    <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:h-screen md:overflow-hidden">
      <div className="w-full max-w-5xl bg-paper border border-line rounded-2xl shadow-lg overflow-hidden grid md:grid-cols-[360px_1fr] md:grid-rows-[minmax(0,1fr)] md:h-[calc(100vh-3rem)]">
        {/* Left: header + form */}
        <div className="flex flex-col gap-5 p-6 sm:p-8 overflow-y-auto min-h-0">
          <header className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-soft">
              A chart fairness check
            </p>
            <h1 className="font-display text-3xl font-medium text-ink">Second Opinion</h1>
            <p className="text-sm text-ink-soft leading-relaxed">
              Upload a chart. Claude reads the real data off it and redraws it honestly &mdash;
              zero baseline, one axis, fair color.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="image-input"
                className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft"
              >
                Image
              </label>
              <label
                htmlFor="image-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-panel hover:border-accent/50 hover:bg-accent-soft/40"
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-ink-soft"
                  aria-hidden="true"
                >
                  <path d="M12 16V4M12 4 7 9M12 4l5 5" />
                  <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
                </svg>
                {file ? (
                  <span className="text-sm font-medium text-ink max-w-full truncate px-2">
                    {file.name}
                  </span>
                ) : (
                  <span className="text-sm text-ink-soft">
                    <span className="text-accent font-medium">Click to upload</span> or drag and
                    drop
                  </span>
                )}
              </label>
              <input
                ref={fileInputRef}
                id="image-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="context-input"
                className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft"
              >
                Context <span className="normal-case font-normal text-ink-soft/70">(optional)</span>
              </label>
              <textarea
                id="context-input"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                placeholder="e.g. this is from a marketing deck, or the real axis min is 50"
                className="block w-full rounded-lg border border-line bg-panel px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={!file || loading}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-paper transition-colors disabled:bg-line disabled:text-ink-soft disabled:cursor-not-allowed enabled:hover:bg-ink enabled:active:scale-[0.99]"
            >
              {loading && (
                <span className="w-4 h-4 rounded-full border-2 border-paper/40 border-t-paper animate-spin" />
              )}
              {loading ? "Analyzing…" : "Analyze chart"}
            </button>
          </form>
        </div>

        {/* Right: results */}
        <div className="flex flex-col gap-5 p-6 sm:p-8 overflow-y-auto min-h-0 border-t md:border-t-0 md:border-l border-line bg-panel/40">
          {!result && !error && (
            <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-line min-h-40">
              <p className="text-sm text-ink-soft/70 italic text-center px-6">
                Your honest redraw will appear here.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose/20 bg-rose-soft px-4 py-3 text-sm text-rose">
              {error}
            </p>
          )}

          {result && (
            <>
              <p className="font-display text-base italic leading-relaxed text-ink border-l-2 border-accent pl-4">
                {result.summary}
              </p>

              {!result.hasVisualization && (
                <p className="rounded-lg border border-line bg-paper px-4 py-3.5 text-sm text-ink-soft italic">
                  {result.note}
                </p>
              )}

              {result.hasVisualization &&
                result.charts.map((chart, i) => (
                  <div key={i} className="flex flex-col gap-2.5">
                    <div className="rounded-lg border border-line bg-paper p-2 shadow-sm">
                      <FairChart chart={chart} />
                    </div>
                    {chart.estimatedFromImage && (
                      <span className="self-start rounded-full bg-warm-soft px-2.5 py-0.5 text-xs font-medium text-warm">
                        Values estimated from the image
                      </span>
                    )}
                    <p className="text-sm text-ink leading-relaxed">{chart.caption}</p>
                    {chart.issues.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {chart.issues.map((issue, j) => (
                          <li
                            key={j}
                            className="text-sm text-ink-soft leading-relaxed pl-4 relative before:content-['\2014'] before:absolute before:left-0 before:text-accent"
                          >
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

              {result.principles.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-soft">
                    Why
                  </p>
                  {result.principles.map((p, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium text-ink">{p.name}</p>
                      <p className="text-sm text-ink-soft leading-relaxed">{p.note}</p>
                      <p className="text-xs text-ink-soft/70 italic">{p.reference}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
