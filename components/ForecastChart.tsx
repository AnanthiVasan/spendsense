"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "@/lib/forecast";
import { formatInr } from "@/lib/money";

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const data = points.map((point) => ({
    ...point,
    label: point.day.slice(5),
    negative: point.projectedBalance < 0 ? point.projectedBalance : null,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => formatInr(Number(value), 0)} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8 }}
            formatter={(value) => formatInr(Number(value ?? 0), 0)}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="upper"
            name="Upper band"
            stroke="none"
            fill="#34d399"
            fillOpacity={0.18}
          />
          <Area
            type="monotone"
            dataKey="lower"
            name="Lower band"
            stroke="none"
            fill="#0b1220"
            fillOpacity={1}
          />
          <Line
            type="monotone"
            dataKey="projectedBalance"
            name="Projected balance"
            stroke="#34d399"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="negative"
            name="Negative"
            stroke="#fb7185"
            dot={{ r: 3, fill: "#fb7185" }}
            strokeWidth={0}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
