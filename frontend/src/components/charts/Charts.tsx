"use client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#4f8ef7", "#8b5cf6", "#ec4899", "#f97316", "#10b981",
  "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#a78bfa",
];

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-light)",
    borderRadius: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    color: "var(--text-primary)",
    fontSize: "13px",
  },
  labelStyle: { color: "var(--text-secondary)", fontWeight: 600 },
  cursor: { fill: "rgba(79,142,247,0.06)" },
};

interface ChartProps {
  data: any[];
  height?: number;
}

//  Yearly Line Chart 
export function YearlyChart({ data, height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="year" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ color: "var(--text-secondary)", fontSize: "12px" }} />
        <Area type="monotone" dataKey="accidents" stroke="#4f8ef7" strokeWidth={2} fill="url(#accGrad)" name="Accidents" dot={{ fill: "#4f8ef7", r: 3 }} />
        <Area type="monotone" dataKey="fatal" stroke="#ef4444" strokeWidth={2} fill="url(#fatGrad)" name="Fatalities" dot={{ fill: "#ef4444", r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

//  Monthly Bar Chart 
export function MonthlyChart({ data, height = 260 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month_name" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="accidents" name="Accidents" radius={[6, 6, 0, 0]}>
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={`url(#monthGrad${i % 2})`} />
          ))}
        </Bar>
        <defs>
          <linearGradient id="monthGrad0" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#4f8ef7" />
          </linearGradient>
          <linearGradient id="monthGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f8ef7" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}

//  Donut / Pie Chart 
interface PieProps extends ChartProps {
  dataKey?: string;
  nameKey?: string;
}
export function DonutChart({ data, height = 280, dataKey = "count", nameKey = "label" }: PieProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="58%"
          outerRadius="80%"
          dataKey={dataKey}
          nameKey={nameKey}
          paddingAngle={3}
        >
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: "10px",
            fontSize: "13px",
            color: "var(--text-primary)",
          }}
          formatter={(value: any, name: any) => [`${value} (${data.find((d: any) => d[nameKey] === name)?.percentage ?? 0}%)`, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)", paddingTop: "16px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

//  Horizontal Bar Chart (Causes) 
export function HBarChart({ data, height = 320, dataKey = "count", nameKey = "label" }: PieProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={nameKey} width={120} stroke="var(--text-muted)" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={dataKey} name="Count" radius={[0, 6, 6, 0]}>
          {data.map((_: any, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

//  Time of Day Radar Chart 
export function TimeRadarChart({ data, height = 300 }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <Radar name="Accidents" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
        <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "10px", fontSize: "13px", color: "var(--text-primary)" }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// Alias so pages can import { CausesChart }
export const CausesChart = HBarChart;

