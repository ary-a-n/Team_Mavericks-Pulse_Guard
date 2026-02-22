import { motion } from "framer-motion";
import { Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DisplayMedication {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  status: "active" | "completed" | "hold";
}

const statusStyle: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-muted text-muted-foreground border-border",
  hold: "bg-warning/10 text-warning border-warning/20",
};

export function MedicationList({ medications }: { medications: DisplayMedication[] }) {
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

      {medications.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body">No medications recorded — N/A</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {medications.map((med, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm font-body border border-border p-3.5 rounded-md bg-background shadow-sm">
              <div className="flex-1 min-w-0">
                <span className="text-foreground/90 font-medium text-base block truncate">{med.name || "N/A"}</span>
                <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-medium">{med.dose || "N/A"}</span>
                  <span>·</span>
                  <span>{med.route || "N/A"}</span>
                  <span>·</span>
                  <span>{med.frequency || "N/A"}</span>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`${statusStyle[med.status]} text-[10px] capitalize rounded-md border font-body px-2 py-0.5 h-fit`}
              >
                {med.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
