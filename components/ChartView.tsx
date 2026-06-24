"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Row = Record<string, string | number>;
interface ChartSpec {
  type: "line" | "bar" | "area" | "pie";
  title?: string;
  x?: string;
  data: Row[];
  series?: { key: string; label?: string; color?: string }[];
}

const PALETTE = ["#e8b339", "#7bb0ff", "#6ee7b7", "#f6a5a5", "#c4a5ff", "#f5c976"];
const axis = { stroke: "#8a8169", fontSize: 11 };
const tooltipStyle = {
  background: "#211d14",
  border: "1px solid #3a3326",
  borderRadius: 10,
  fontSize: 12,
  color: "#f3eee3",
};

/** Tolerant chart-spec parser: handles a stray language word, trailing commas. */
export function parseChartSpec(source: string): ChartSpec | null {
  let t = source.trim();
  if (!t.startsWith("{")) {
    const i = t.indexOf("{");
    if (i < 0) return null;
    t = t.slice(i); // drop a leading tag like "chart\n"
  }
  t = t.replace(/,(\s*[}\]])/g, "$1"); // tolerate trailing commas
  try {
    const spec = JSON.parse(t) as ChartSpec;
    if (
      !spec?.type ||
      !["line", "bar", "area", "pie"].includes(spec.type) ||
      !Array.isArray(spec.data) ||
      spec.data.length === 0
    ) {
      return null;
    }
    return spec;
  } catch {
    return null;
  }
}

export function ChartView({ source }: { source: string }) {
  // Render the chart only after mount: recharts measures its container with a
  // ResizeObserver, which does not run during SSR and can otherwise hydrate to
  // a zero-size (invisible) chart.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const spec = parseChartSpec(source);
  if (!spec) {
    return (
      <pre className="text-xs text-muted">
        <code>{source}</code>
      </pre>
    );
  }

  const xKey = spec.x ?? "x";
  // Models often emit numbers as strings ("30"); coerce so series are not empty.
  const data: Row[] = spec.data.map((row) => {
    const r: Row = {};
    for (const [k, v] of Object.entries(row)) {
      r[k] = typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
    }
    return r;
  });
  const numericKeys = Object.keys(data[0]).filter(
    (k) => k !== xKey && typeof data[0][k] === "number",
  );
  // Keep only series whose key actually exists in the data; if the model gave
  // mismatched keys, fall back to auto-detected numeric columns.
  const provided = (spec.series ?? []).filter((s) => numericKeys.includes(s.key));
  const series: { key: string; label?: string; color?: string }[] =
    provided.length > 0 ? provided : numericKeys.map((key) => ({ key }));

  const color = (i: number, c?: string) => c ?? PALETTE[i % PALETTE.length];

  return (
    <figure className="my-3 rounded-xl border border-border bg-bg/40 p-3">
      {spec.title && (
        <figcaption className="mb-2 px-1 text-sm font-medium text-foreground">
          {spec.title}
        </figcaption>
      )}
      <div className="h-[280px] w-full">
        {!mounted ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-elevated/40" />
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                dataKey={series[0]?.key ?? "value"}
                nameKey={xKey === "x" ? "name" : xKey}
                outerRadius={100}
                label
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          ) : spec.type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2519" />
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff10" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={color(i, s.color)} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : spec.type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2519" />
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, i) => (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  name={s.label ?? s.key}
                  stroke={color(i, s.color)}
                  fill={color(i, s.color)}
                  fillOpacity={0.18}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2519" />
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label ?? s.key}
                  stroke={color(i, s.color)}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
        )}
      </div>
    </figure>
  );
}
