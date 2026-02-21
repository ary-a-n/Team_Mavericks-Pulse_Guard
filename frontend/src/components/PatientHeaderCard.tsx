import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { User, Stethoscope, MapPin, BedDouble, AlertTriangle } from "lucide-react";
import type { Patient } from "@/data/mockPatient";

const statusColors: Record<string, string> = {
  Stable: "bg-success text-success-foreground",
  Critical: "bg-destructive text-destructive-foreground",
  Watchlist: "bg-warning text-warning-foreground",
};

export function PatientHeaderCard({ patient }: { patient: Patient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg bg-card p-6 border border-border"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl lg:text-4xl font-heading text-foreground tracking-tight">
              {patient.name}
            </h1>
            <Badge className={`${statusColors[patient.status]} text-sm px-3 py-1 font-body font-medium rounded-md border-0`}>
              {patient.status}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground text-base">
            <span className="flex items-center gap-1.5">
              <User size={16} /> {patient.age} yrs
            </span>
            <span className="flex items-center gap-1.5">
              <BedDouble size={16} /> Bed {patient.bed}
            </span>
            <span className="flex items-center gap-1.5">
              <Stethoscope size={16} /> {patient.doctor}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={16} /> {patient.ward}
            </span>
          </div>

          <p className="text-foreground/80 text-base max-w-2xl leading-relaxed">
            {patient.diagnosis}
          </p>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-body font-medium">
            Allergies
          </span>
          <div className="flex flex-wrap gap-2">
            {patient.allergies.map((a) => (
              <Badge
                key={a}
                variant="outline"
                className="bg-destructive/10 text-destructive border-destructive/20 font-body text-sm px-2.5 py-0.5 rounded-md"
              >
                <AlertTriangle size={12} className="mr-1" />
                {a}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
