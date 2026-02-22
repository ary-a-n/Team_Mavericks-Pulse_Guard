import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ListTodo } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientTimeline } from "@/components/PatientTimeline";
import { PatientHeaderCard } from "@/components/PatientHeaderCard";
import { VitalCard } from "@/components/VitalCard";
import { RiskAlertCard } from "@/components/RiskAlertCard";
import { MedicationList } from "@/components/MedicationList";
import { InvestigationList } from "@/components/InvestigationList";
import { getPatientDashboard, PatientDashboard } from "@/lib/api/patients";

interface HinglishSummary {
  patient_overview?: string;
  medications?: string[];
  risk_alerts?: string[];
  missing_info?: string[];
  action_items?: string[];
}

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

type DisplayStatus = "Stable" | "Critical" | "Watchlist";

interface DisplayVital {
  label: string;
  value: string;
  unit: string;
  icon: "Heart" | "Activity" | "Wind" | "Thermometer" | "Droplets";
  status: "normal" | "warning" | "critical";
}

interface DisplayMedication {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  status: "active" | "completed" | "hold";
}

interface DisplayInvestigation {
  name: string;
  status: "pending" | "completed";
  result?: string;
  orderedAt: string;
}

interface DisplayPatient {
  name: string;
  age: number;
  bed: string;
  doctor: string;
  ward: string;
  status: DisplayStatus;
  allergies: string[];
  diagnosis: string;
  vitals: DisplayVital[];
  medications: DisplayMedication[];
  investigations: DisplayInvestigation[];
  riskTimeline: Array<{ shift: string; time: string; score: number; label?: string }>;
  eventsTimeline: Array<{
    id: string;
    type: "medication" | "test" | "vitals" | "handoff" | "note";
    time: string;
    label: string;
    detail?: string;
  }>;
  riskFlags: string[];
  actionItems: string[];
}

const statusMap: Record<string, DisplayStatus> = {
  active: "Stable",
  stable: "Stable",
  critical: "Critical",
  watchlist: "Watchlist",
};

const iconFromVitalType = (vitalType: string): DisplayVital["icon"] => {
  const value = vitalType.toLowerCase();
  if (value.includes("heart") || value.includes("pulse")) return "Heart";
  if (value.includes("pressure") || value.includes("bp")) return "Activity";
  if (value.includes("spo") || value.includes("oxygen")) return "Wind";
  if (value.includes("temp")) return "Thermometer";
  if (value.includes("glucose") || value.includes("sugar")) return "Droplets";
  return "Activity";
};

const splitValueAndUnit = (raw: string): { value: string; unit: string } => {
  const match = raw.match(/^(.+?)\s+([%°a-zA-Z/]+)$/);
  if (!match) {
    return { value: raw, unit: "" };
  }
  return { value: match[1], unit: match[2] };
};

const toMedicationStatus = (dose: string): DisplayMedication["status"] => {
  const value = dose.toLowerCase();
  if (value.includes("hold")) return "hold";
  return "active";
};

const dashboardToDisplayPatient = (dashboard: PatientDashboard): DisplayPatient => {
  const latestByType = Object.values(
    dashboard.recent_vitals.reduce<Record<string, (typeof dashboard.recent_vitals)[number]>>(
      (acc, vital) => {
        if (!acc[vital.vital_type] || vital.recorded_at > acc[vital.vital_type].recorded_at) {
          acc[vital.vital_type] = vital;
        }
        return acc;
      },
      {}
    )
  );

  const vitalsFromDashboard: DisplayVital[] = latestByType.map((vital) => {
    const parts = splitValueAndUnit(vital.value);
    const status: DisplayVital["status"] =
      vital.trend?.toLowerCase().includes("critical")
        ? "critical"
        : vital.trend?.toLowerCase().includes("watch")
          ? "warning"
          : "normal";

    return {
      label: vital.vital_type,
      value: parts.value,
      unit: parts.unit,
      icon: iconFromVitalType(vital.vital_type),
      status,
    };
  });

  const medsFromDashboard: DisplayMedication[] = dashboard.recent_medications.map((medication) => ({
    name: medication.med_name,
    dose: medication.dose,
    route: "PO",
    frequency: "As advised",
    status: toMedicationStatus(medication.dose),
  }));

  const hinglish = dashboard.latest_handoff?.agent_output_json?.hinglish_summary as HinglishSummary | undefined;
  const riskFlags =
    dashboard.active_risks.length > 0
      ? dashboard.active_risks.map((risk) => risk.risk_type)
      : hinglish?.risk_alerts && hinglish.risk_alerts.length > 0
        ? hinglish.risk_alerts
        : [];

  const investigations: DisplayInvestigation[] = [];

  const actionItems =
    hinglish?.action_items && hinglish.action_items.length > 0 ? hinglish.action_items : [];

  return {
    name: dashboard.patient.name,
    age: dashboard.patient.age ?? 0,
    bed: dashboard.patient.bed_number ?? "—",
    doctor: "Not assigned",
    ward: "ICU-3A",
    status: statusMap[dashboard.patient.status?.toLowerCase() ?? "stable"] ?? "Stable",
    allergies: [],
    diagnosis: hinglish?.patient_overview ?? dashboard.patient.admission_reason ?? "No diagnosis recorded",
    vitals: vitalsFromDashboard.slice(0, 5),
    medications: medsFromDashboard,
    investigations,
    riskTimeline: [],
    eventsTimeline: [],
    riskFlags,
    actionItems,
  };
};

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
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load patient"))
      .finally(() => setIsLoading(false));
  }, [patientId]);

  const displayPatient = useMemo(() => {
    if (!dashboard) return null;
    return dashboardToDisplayPatient(dashboard);
  }, [dashboard]);

  const hinglish = dashboard?.latest_handoff?.agent_output_json?.hinglish_summary as HinglishSummary | undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Loading patient data…</p>
      </div>
    );
  }

  if (error || !displayPatient) {
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

  return (
    <Layout>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={20} />
            </Button>
            <PatientTimeline patientId={dashboard!.patient.id} patientName={displayPatient.name} />
          </div>

          <PatientHeaderCard patient={displayPatient} />

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-stretch">
            {displayPatient.vitals.slice(0, 5).map((vital, index) => (
              <div key={`${vital.label}-${index}`} className="lg:col-span-1">
                <VitalCard vital={vital} index={index} />
              </div>
            ))}
            <div className="lg:col-span-5">
              <RiskAlertCard
                riskFlags={displayPatient.riskFlags}
                actionItems={displayPatient.actionItems}
              />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl font-heading text-primary">
                <ListTodo size={18} />
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {displayPatient.actionItems.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-2 text-base font-body text-foreground/80">
                    <CheckCircle2 size={16} className="mt-1 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MedicationList medications={displayPatient.medications} />
            <InvestigationList investigations={displayPatient.investigations} />
          </div>

          {!!hinglish && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-heading text-foreground">
                  Latest Handoff Analysis
                  {dashboard?.latest_handoff?.shift_time && (
                    <span className="text-sm font-body text-muted-foreground ml-3 font-normal">
                      {formatDateTime(dashboard.latest_handoff.shift_time)}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!!hinglish.patient_overview && (
                  <p className="text-sm font-body text-foreground/80 leading-relaxed">
                    {hinglish.patient_overview}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!!hinglish.medications?.length && (
                    <div>
                      <h4 className="text-sm font-heading text-primary mb-2">Medications &amp; Timing</h4>
                      <ul className="space-y-1.5">
                        {hinglish.medications.map((item, index) => (
                          <li key={`${item}-${index}`} className="text-sm font-body text-foreground/80">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!!hinglish.risk_alerts?.length && (
                    <div>
                      <h4 className="text-sm font-heading text-destructive mb-2">Risk Alerts</h4>
                      <ul className="space-y-1.5">
                        {hinglish.risk_alerts.map((item, index) => (
                          <li key={`${item}-${index}`} className="text-sm font-body text-foreground/80">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {!!hinglish.missing_info?.length && (
                  <div>
                    <h4 className="text-sm font-heading text-warning mb-2">Missing Info</h4>
                    <ul className="space-y-1.5">
                      {hinglish.missing_info.map((item, index) => (
                        <li key={`${item}-${index}`} className="text-sm font-body text-foreground/80">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-border text-center">
          <span className="text-xs text-muted-foreground font-body">Team Mavricks || PEC</span>
        </div>
      </div>
    </Layout>
  );
};

export default PatientDetail;
