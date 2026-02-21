import { useParams, useNavigate } from "react-router-dom";
import { getPatientById } from "@/data/mockPatients";
import { PatientHeaderCard } from "@/components/PatientHeaderCard";
import { VitalCard } from "@/components/VitalCard";
import { RiskAlertCard } from "@/components/RiskAlertCard";
import { InvestigationList } from "@/components/InvestigationList";
import { MedicationList } from "@/components/MedicationList";
import { RiskTrajectoryChart } from "@/components/RiskTrajectoryChart";
import { TreatmentTimeline } from "@/components/TreatmentTimeline";
import { ArrowLeft, ListTodo, CheckCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

const PatientDetail = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const patient = getPatientById(patientId || "");

  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Patient not found.</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="mb-6 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </Button>

          <div className="space-y-6">
            <PatientHeaderCard patient={patient} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {patient.vitals.map((v, i) => (
                    <VitalCard key={v.label} vital={v} index={i} />
                  ))}
                </div>
              </div>
              <div className="lg:col-span-1">
                <RiskAlertCard riskFlags={patient.riskFlags} actionItems={patient.actionItems} />
              </div>
            </div>

            <div>
              <div className="rounded-lg bg-card border border-border p-5">
                <h3 className="flex items-center gap-2 text-lg font-heading text-primary mb-3">
                  <ListTodo size={18} />
                  Action Items
                </h3>
                <ul className="space-y-2">
                  {patient.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80 font-body leading-relaxed">
                      <CheckCircle size={14} className="mt-0.5 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InvestigationList investigations={patient.investigations} />
              <MedicationList medications={patient.medications} />
            </div>

            <RiskTrajectoryChart data={patient.riskTimeline} />
            <TreatmentTimeline events={patient.eventsTimeline} />
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-border text-center">
          <span className="text-xs text-muted-foreground font-body">
            Team Mavricks || PEC
          </span>
        </div>
      </div>
    </Layout>
  );
};

export default PatientDetail;
