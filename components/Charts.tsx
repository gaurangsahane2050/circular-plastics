"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// fixed colour per plastic, same everywhere (checked for colour-blind separation)
export const TYPE_COLOR = { PET: "#2a78d6", HDPE: "#eb6834", PP: "#1baf7a", LDPE: "#eda100" };
const AXIS = { fontSize: 12, fill: "#52514e" };

// kg recycled per week, stacked by plastic type
export function WeeklyChart({ data, unit }: { data: Record<string, string | number>[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit={` ${unit}`} width={72} />
        <Tooltip formatter={(v) => `${Math.round(Number(v))} ${unit}`} cursor={{ fill: "#f3f4f6" }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
        {Object.entries(TYPE_COLOR).map(([type, color], i, all) => (
          <Bar key={type} dataKey={type} stackId="kg" isAnimationActive={false} fill={color} stroke="#fff" strokeWidth={1}
            radius={i === all.length - 1 ? [4, 4, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// one value per area, as horizontal bars (area names stay readable on a phone)
export function AreaChart({ data, unit, max }: { data: { area: string; value: number }[]; unit: string; max?: number }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 30}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48 }}>
        <XAxis type="number" hide domain={[0, max ?? "auto"]} />
        <YAxis type="category" dataKey="area" tick={AXIS} tickLine={false} axisLine={false} width={110} />
        <Tooltip formatter={(v) => `${Math.round(Number(v))}${unit}`} cursor={{ fill: "#f3f4f6" }} />
        <Bar dataKey="value" fill="#2a78d6" isAnimationActive={false} radius={[0, 4, 4, 0]} barSize={18}
          label={{ position: "right", fontSize: 12, fill: "#0b0b0b", formatter: (v: unknown) => `${Math.round(Number(v))}${unit}` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
