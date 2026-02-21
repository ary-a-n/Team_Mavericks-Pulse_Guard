import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import type { RiskTimelinePoint } from "@/data/mockPatient";

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const d = payload[0].payload as RiskTimelinePoint;
    return (
      <div className="rounded-md bg-card border border-border px-3 py-2 text-sm font-body shadow-sm">
        <p className="font-medium text-foreground">{d.shift} Shift — {d.time}</p>
        <p className="text-primary font-heading text-lg">Risk: {d.score.toFixed(1)}</p>
        {d.label && <p className="text-xs text-muted-foreground mt-1">{d.label}</p>}
      </div>
    );
  }
  return null;
}

export function RiskTrajectoryChart({ data }: { data: RiskTimelinePoint[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-lg bg-card border border-border p-6"
    >
      <h3 className="flex items-center gap-2 text-xl font-heading text-foreground mb-1">
        <TrendingUp size={20} className="text-primary" />
        Risk Trajectory Timeline
      </h3>
      <p className="text-sm text-muted-foreground font-body mb-6">
        AI-computed risk score across shifts — temporal reasoning visualization
      </p>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(207, 22%, 54%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(207, 22%, 54%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 85%)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12, fill: "hsl(0, 0%, 45%)" }}
              axisLine={{ stroke: "hsl(40, 20%, 85%)" }}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 12, fill: "hsl(0, 0%, 45%)" }}
              axisLine={{ stroke: "hsl(40, 20%, 85%)" }}
              label={{ value: "Risk Score", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(0, 0%, 45%)" } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={7} stroke="hsl(0, 68%, 67%)" strokeDasharray="4 4" label={{ value: "High Risk", position: "right", style: { fontSize: 10, fill: "hsl(0, 68%, 67%)" } }} />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(207, 22%, 54%)"
              strokeWidth={2.5}
              fill="url(#riskGradient)"
              dot={{ r: 4, fill: "hsl(207, 22%, 54%)", stroke: "hsl(45, 100%, 98%)", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "hsl(207, 22%, 54%)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
