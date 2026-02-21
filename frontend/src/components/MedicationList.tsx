import { motion } from "framer-motion";
import { Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Medication } from "@/data/mockPatient";

const statusStyle: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-muted text-muted-foreground border-border",
  hold: "bg-warning/10 text-warning border-warning/20",
};

export function MedicationList({ medications }: { medications: Medication[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-lg bg-card border border-border p-5 h-full"
    >
      <h3 className="flex items-center gap-2 text-lg font-heading text-foreground mb-4">
        <Pill size={18} className="text-primary" />
        Current Medications
      </h3>

      <ul className="space-y-3">
        {medications.map((med, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm font-body">
            <div className="flex-1 min-w-0">
              <span className="text-foreground/90 font-medium">{med.name}</span>
              <div className="text-xs text-muted-foreground mt-0.5">
                {med.dose} · {med.route} · {med.frequency}
              </div>
            </div>
            <Badge
              variant="outline"
              className={`${statusStyle[med.status]} text-xs capitalize rounded-md border font-body px-2 py-0.5`}
            >
              {med.status}
            </Badge>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
