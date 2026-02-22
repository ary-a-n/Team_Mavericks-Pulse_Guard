import React from "react";
import { motion } from "framer-motion";
import { Heart, Activity, Wind, Thermometer, Droplets } from "lucide-react";

interface DisplayVital {
  label: string;
  value: string;
  unit: string;
  icon: "Heart" | "Activity" | "Wind" | "Thermometer" | "Droplets";
  status: "normal" | "warning" | "critical";
}

const iconMap: Record<string, React.ElementType> = {
  Heart,
  Activity,
  Wind,
  Thermometer,
  Droplets,
};

const statusBorder: Record<string, string> = {
  normal: "border-success/30",
  warning: "border-warning/40",
  critical: "border-destructive/50",
};

const statusText: Record<string, string> = {
  normal: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

export function VitalCard({ vital, index }: { vital: DisplayVital; index: number }) {
  const Icon = iconMap[vital.icon] || Heart;
  const isHeartRate = vital.label === "Heart Rate";
  const iconColor = isHeartRate ? "text-red-600" : statusText[vital.status];
  const valueColor = isHeartRate ? "text-red-600" : statusText[vital.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`rounded-lg bg-card border-2 ${statusBorder[vital.status]} p-4 flex flex-col items-center gap-2 text-center`}
    >
      <Icon size={22} className={iconColor} />
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-body font-medium">
        {vital.label}
      </span>
      <span className={`text-2xl font-heading ${valueColor}`}>
        {vital.value || "N/A"}
      </span>
      <span className="text-xs text-muted-foreground">{vital.unit}</span>
    </motion.div>
  );
}
