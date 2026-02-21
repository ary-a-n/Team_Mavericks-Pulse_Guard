import { AlertTriangle } from "lucide-react";

export function RiskAlertCard({ riskFlags, actionItems }: { riskFlags: string[]; actionItems: string[] }) {
  return (
    <div className="rounded-lg bg-destructive/5 border border-destructive/15 p-5">
      <h3 className="flex items-center gap-2 text-lg font-heading text-destructive mb-3">
        <AlertTriangle size={18} />
        Risk Flags
      </h3>
      <ul className="space-y-2">
        {riskFlags.map((flag, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80 font-body leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
            {flag}
          </li>
        ))}
      </ul>
    </div>
  );
}
