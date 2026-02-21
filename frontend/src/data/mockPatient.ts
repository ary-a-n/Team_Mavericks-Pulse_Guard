export interface Vital {
  label: string;
  value: string;
  unit: string;
  icon: string;
  status: "normal" | "warning" | "critical";
}

export interface Medication {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  status: "active" | "completed" | "hold";
}

export interface Investigation {
  name: string;
  status: "pending" | "completed";
  result?: string;
  orderedAt: string;
}

export interface RiskTimelinePoint {
  shift: string;
  time: string;
  score: number;
  label?: string;
}

export interface TimelineEvent {
  id: string;
  type: "medication" | "test" | "vitals" | "handoff" | "note";
  time: string;
  label: string;
  detail?: string;
}

export interface Patient {
  name: string;
  age: number;
  bed: string;
  doctor: string;
  ward: string;
  status: "Stable" | "Critical" | "Watchlist";
  allergies: string[];
  diagnosis: string;
  vitals: Vital[];
  medications: Medication[];
  investigations: Investigation[];
  riskTimeline: RiskTimelinePoint[];
  eventsTimeline: TimelineEvent[];
  riskFlags: string[];
  actionItems: string[];
}

export const mockPatient: Patient = {
  name: "Mrs. Evelyn Harper",
  age: 72,
  bed: "B-14",
  doctor: "Dr. Anand Mehta",
  ward: "ICU-3A",
  status: "Watchlist",
  allergies: ["Penicillin", "Sulfa drugs", "Latex"],
  diagnosis: "Acute exacerbation of COPD with secondary pneumonia. History of Type 2 DM, HTN.",
  vitals: [
    { label: "Heart Rate", value: "92", unit: "bpm", icon: "Heart", status: "normal" },
    { label: "Blood Pressure", value: "148/92", unit: "mmHg", icon: "Activity", status: "warning" },
    { label: "SpO₂", value: "91", unit: "%", icon: "Wind", status: "warning" },
    { label: "Temperature", value: "38.2", unit: "°C", icon: "Thermometer", status: "warning" },
    { label: "Glucose", value: "186", unit: "mg/dL", icon: "Droplets", status: "warning" },
  ],
  medications: [
    { name: "Salbutamol Nebulization", dose: "2.5mg", route: "Inhaled", frequency: "Q4H", status: "active" },
    { name: "Ceftriaxone", dose: "1g", route: "IV", frequency: "BD", status: "active" },
    { name: "Metformin", dose: "500mg", route: "PO", frequency: "BD", status: "active" },
    { name: "Amlodipine", dose: "5mg", route: "PO", frequency: "OD", status: "active" },
    { name: "Paracetamol", dose: "650mg", route: "PO", frequency: "PRN", status: "hold" },
  ],
  investigations: [
    { name: "CBC with Differential", status: "completed", result: "WBC 14.2k — elevated", orderedAt: "06:00" },
    { name: "Chest X-Ray PA", status: "completed", result: "Bilateral infiltrates", orderedAt: "06:30" },
    { name: "ABG Analysis", status: "pending", orderedAt: "10:00" },
    { name: "Blood Culture", status: "pending", orderedAt: "10:15" },
    { name: "HbA1c", status: "completed", result: "8.2%", orderedAt: "06:00" },
  ],
  riskTimeline: [
    { shift: "Night", time: "00:00", score: 3.2, label: "Stable" },
    { shift: "Night", time: "04:00", score: 4.1 },
    { shift: "Morning", time: "06:00", score: 5.8, label: "SpO₂ drop noted" },
    { shift: "Morning", time: "08:00", score: 6.4 },
    { shift: "Morning", time: "10:00", score: 7.1, label: "Fever spike" },
    { shift: "Afternoon", time: "12:00", score: 6.8 },
    { shift: "Afternoon", time: "14:00", score: 5.9, label: "Post-nebulization improvement" },
  ],
  eventsTimeline: [
    { id: "1", type: "handoff", time: "06:00", label: "Night → Morning Handoff", detail: "Patient restless, O2 requirement increased" },
    { id: "2", type: "vitals", time: "06:15", label: "Vitals Recorded", detail: "SpO₂ 89%, started O2 at 4L" },
    { id: "3", type: "test", time: "06:30", label: "CXR Ordered", detail: "Bilateral infiltrates found" },
    { id: "4", type: "medication", time: "07:00", label: "Ceftriaxone Administered", detail: "1g IV as scheduled" },
    { id: "5", type: "medication", time: "08:00", label: "Nebulization Given", detail: "Salbutamol 2.5mg" },
    { id: "6", type: "vitals", time: "10:00", label: "Temp Spike 38.2°C", detail: "ABG ordered" },
    { id: "7", type: "note", time: "10:30", label: "Nurse Note", detail: "Patient more alert, tolerating O2" },
    { id: "8", type: "test", time: "11:00", label: "Blood Culture Sent" },
    { id: "9", type: "handoff", time: "14:00", label: "Morning → Afternoon Handoff", detail: "Improving post-nebulization, await ABG" },
  ],
  riskFlags: [
    "Oxygen saturation trending below 92%",
    "Elevated WBC — possible sepsis progression",
    "Blood glucose poorly controlled (HbA1c 8.2%)",
  ],
  actionItems: [
    "Follow up ABG results",
    "Reassess O₂ requirement at 16:00",
    "Endocrinology consult for glycemic control",
    "Repeat CBC in 12 hours",
  ],
};
