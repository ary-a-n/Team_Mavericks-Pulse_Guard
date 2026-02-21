import { motion } from "framer-motion";
import { FlaskConical, Clock, CheckCircle2 } from "lucide-react";
import type { Investigation } from "@/data/mockPatient";

export function InvestigationList({ investigations }: { investigations: Investigation[] }) {
  const pending = investigations.filter((i) => i.status === "pending");
  const completed = investigations.filter((i) => i.status === "completed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-lg bg-card border border-border p-5 h-full"
    >
      <h3 className="flex items-center gap-2 text-lg font-heading text-foreground mb-4">
        <FlaskConical size={18} className="text-primary" />
        Investigations
      </h3>

      {pending.length > 0 && (
        <div className="mb-4">
          <span className="text-xs uppercase tracking-wider text-warning font-body font-medium">Pending</span>
          <ul className="mt-2 space-y-2">
            {pending.map((inv, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground/80 font-body">
                <Clock size={14} className="text-warning shrink-0" />
                <span>{inv.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{inv.orderedAt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <span className="text-xs uppercase tracking-wider text-success font-body font-medium">Completed</span>
          <ul className="mt-2 space-y-2">
            {completed.map((inv, i) => (
              <li key={i} className="flex flex-col gap-0.5 text-sm font-body">
                <div className="flex items-center gap-2 text-foreground/80">
                  <CheckCircle2 size={14} className="text-success shrink-0" />
                  <span>{inv.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{inv.orderedAt}</span>
                </div>
                {inv.result && (
                  <span className="ml-6 text-xs text-muted-foreground">{inv.result}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
