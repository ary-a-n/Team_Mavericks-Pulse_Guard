import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ListTodo,
  CheckCircle,
  AlertTriangle,
  Pill,
  Activity,
  User,
  Info,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPatientDashboard,
  PatientDashboard,
  ActiveRiskResponse,
  VitalsHistoryResponse,
  MedicationHistoryResponse,
} from "@/lib/api/patients";
import { PatientTimeline } from "@/components/PatientTimeline";

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

interface HinglishSummary {
  patient_overview?: string;
  medications?: string[];
  risk_alerts?: string[];
  missing_info?: string[];
  action_items?: string[];
}

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-success/15 text-success border-success/30",
};

/** Pull "[HIGH]" / "[CRITICAL]" prefix out of an alert string for colouring. */
function parseAlertSeverity(alert: string): string {
  const match = alert.match(/\[(CRITICAL|HIGH|MEDIUM|LOW)\]/i);
  return match ? match[1].toLowerCase() : "";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ──────────────────────────────────────────────────────
// Sub-components — live DB data
// ──────────────────────────────────────────────────────

function RisksCard({ risks }: { risks: ActiveRiskResponse[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-primary">
          <AlertTriangle size={16} />
          Active Risks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {risks.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body">No active risks recorded.</p>
        ) : (
          <ul className="space-y-2">
            {risks.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-body text-foreground/80">{r.risk_type}</span>
                <Badge
                  variant="outline"
                  className={SEVERITY_COLORS[r.severity?.toLowerCase()] ?? ""}
                >
                  {r.severity}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function VitalsCard({ vitals }: { vitals: VitalsHistoryResponse[] }) {
  const latest = Object.values(
    vitals.reduce<Record<string, VitalsHistoryResponse>>((acc, v) => {
      if (!acc[v.vital_type] || v.recorded_at > acc[v.vital_type].recorded_at)
        acc[v.vital_type] = v;
      return acc;
    }, {})
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-primary">
          <Activity size={16} />
          Latest Vitals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body">No vitals recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {latest.map((v) => (
              <div key={v.id} className="rounded-lg bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
                  {v.vital_type}
                </p>
                <p className="text-lg font-heading font-semibold text-foreground mt-0.5">
                  {v.value}
                </p>
                {v.trend && v.trend !== "unknown" && (
                  <p className="text-xs text-muted-foreground font-body mt-0.5">{v.trend}</p>
                )}
                <p className="text-xs text-muted-foreground/60 font-body mt-1">
                  {formatDateTime(v.recorded_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MedsCard({ medications }: { medications: MedicationHistoryResponse[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-primary">
          <Pill size={16} />
          Recent Medications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {medications.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body">No medications recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {medications.slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-body font-medium text-foreground">{m.med_name}</span>
                <span className="text-muted-foreground font-body">{m.dose}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────
// Sub-components — agent handoff analysis sections
// ──────────────────────────────────────────────────────

function OverviewSection({ text }: { text: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-primary">
          <User size={16} />
          Patient Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-body text-foreground/80 leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}

function AgentMedsSection({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-primary">
          <Pill size={16} />
          Medications &amp; Timing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm font-body text-foreground/80 leading-relaxed">
              • {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AlertsSection({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-destructive">
          <AlertTriangle size={16} />
          Risk Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map((alert, i) => {
            const sev = parseAlertSeverity(alert);
            return (
              <li
                key={i}
                className={`text-sm font-body leading-relaxed px-3 py-2 rounded-md border ${SEVERITY_COLORS[sev] ?? "bg-muted/30 text-foreground/80"
                  }`}
              >
                {alert}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function MissingInfoSection({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-warning">
          <Info size={16} />
          Missing Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm font-body text-foreground/80 leading-relaxed">
              • {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ActionItemsSection({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading text-primary">
          <ListTodo size={16} />
          Action Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm font-body text-foreground/80 leading-relaxed">
              <CheckCircle size={14} className="mt-0.5 text-primary shrink-0" />
              {item}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────

const PatientDetail = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(patientId);
    if (!id) {
      setError("Invalid patient ID");
      setIsLoading(false);
      return;
    }
    getPatientDashboard(id)
      .then(setDashboard)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load patient")
      )
      .finally(() => setIsLoading(false));
  }, [patientId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading patient data…</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg font-body">{error ?? "Patient not found."}</p>
        <Button variant="ghost" onClick={() => navigate("/")}>
          <ArrowLeft size={16} className="mr-2" />
          Back to Ward
        </Button>
      </div>
    );
  }

  const { patient, active_risks, recent_vitals, recent_medications, latest_handoff } = dashboard;
  const hinglish = latest_handoff?.agent_output_json?.hinglish_summary as HinglishSummary | undefined;

  return (
    <Layout>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={20} />
            </Button>
            <PatientTimeline patientId={patient.id} patientName={patient.name} />
          </div>

          <div className="space-y-6">
            {/* Patient Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="font-heading text-2xl font-bold text-foreground">
                      {patient.name}
                    </h1>
                    <p className="text-muted-foreground font-body mt-1 text-sm">
                      {patient.age ? `${patient.age} yrs` : "Age unknown"} ·{" "}
                      Bed {patient.bed_number ?? "—"} ·{" "}
                      {patient.admission_reason ?? "No admission reason recorded"}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize text-sm px-3 py-1">
                    {patient.status ?? "active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Live data: vitals + risks + meds */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <VitalsCard vitals={recent_vitals} />
                <MedsCard medications={recent_medications} />
              </div>
              <div>
                <RisksCard risks={active_risks} />
              </div>
            </div>

            {/* Agent handoff analysis — one card per section */}
            {hinglish && (
              <>
                <div className="pt-2">
                  <h2 className="font-heading text-lg text-foreground mb-4">
                    Latest Handoff Analysis
                    {latest_handoff?.shift_time && (
                      <span className="text-sm font-body text-muted-foreground ml-3">
                        {formatDateTime(latest_handoff.shift_time)}
                      </span>
                    )}
                  </h2>
                  <div className="space-y-4">
                    {hinglish.patient_overview && (
                      <OverviewSection text={hinglish.patient_overview} />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <AgentMedsSection items={hinglish.medications ?? []} />
                      <AlertsSection alerts={hinglish.risk_alerts ?? []} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MissingInfoSection items={hinglish.missing_info ?? []} />
                      <ActionItemsSection items={hinglish.action_items ?? []} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-border text-center">
          <span className="text-xs text-muted-foreground font-body">Team Mavricks || PEC</span>
        </div>
      </div>
    </Layout>
  );
};

export default PatientDetail;
