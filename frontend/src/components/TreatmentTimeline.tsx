import { motion } from "framer-motion";
import { Pill, FlaskConical, Activity, ArrowRightLeft, StickyNote, Clock, Moon, Sun } from "lucide-react";
import type { TimelineEvent } from "@/data/mockPatient";

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  medication: { icon: Pill, color: "bg-success/15 text-success" },
  test: { icon: FlaskConical, color: "bg-primary/15 text-primary" },
  vitals: { icon: Activity, color: "bg-warning/15 text-warning" },
  handoff: { icon: ArrowRightLeft, color: "bg-accent/20 text-accent" },
  note: { icon: StickyNote, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

const getHandoffIcon = (label: string): { icon: React.ElementType; color: string } => {
  if (label.includes("Night")) return { icon: Moon, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" };
  if (label.includes("Morning") || label.includes("Afternoon")) return { icon: Sun, color: "bg-amber-50 text-amber-600 dark:bg-amber-900 dark:text-amber-200" };
  return { icon: ArrowRightLeft, color: "bg-accent/20 text-accent" };
};

export function TreatmentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-lg bg-card border border-border p-8"
    >
      <h3 className="flex items-center gap-2 text-xl font-heading text-foreground mb-8">
        <Clock size={20} className="text-primary" />
        Treatment Timeline
      </h3>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {events.map((event, i) => {
            const baseConfig = typeConfig[event.type] || typeConfig.note;
            const { icon: Icon, color: iconColor } = event.type === "handoff" ? getHandoffIcon(event.label) : { icon: baseConfig.icon, color: baseConfig.color };

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.04 }}
                className="flex flex-col items-center gap-3 min-w-[160px]"
              >
                <div className={`rounded-full p-3 ${iconColor}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-body font-medium text-muted-foreground">{event.time}</span>
                <span className="text-xs font-body text-center text-foreground/80 leading-snug font-medium">
                  {event.label}
                </span>
                {event.detail && (
                  <span className="text-[11px] font-body text-center text-muted-foreground leading-snug">
                    {event.detail}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
