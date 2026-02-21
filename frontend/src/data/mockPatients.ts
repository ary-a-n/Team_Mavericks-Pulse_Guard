import { Patient, mockPatient } from "./mockPatient";

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  bed: string;
  ward: string;
  status: "Stable" | "Critical" | "Watchlist";
  doctor: string;
}

export const mockPatientsList: PatientSummary[] = [
  { id: "P-1001", name: "Mrs. Evelyn Harper", age: 72, bed: "B-14", ward: "ICU-3A", status: "Watchlist", doctor: "Dr. Anand Mehta" },
  { id: "P-1002", name: "Mr. James Whitfield", age: 58, bed: "B-07", ward: "ICU-3A", status: "Critical", doctor: "Dr. Priya Sharma" },
  { id: "P-1003", name: "Ms. Clara Bennett", age: 45, bed: "B-22", ward: "ICU-3A", status: "Stable", doctor: "Dr. Anand Mehta" },
  { id: "P-1004", name: "Mr. Robert Chen", age: 67, bed: "B-03", ward: "ICU-3A", status: "Watchlist", doctor: "Dr. Lisa Wong" },
  { id: "P-1005", name: "Mrs. Fatima Al-Rashid", age: 80, bed: "B-19", ward: "ICU-3A", status: "Critical", doctor: "Dr. Priya Sharma" },
  { id: "P-1006", name: "Mr. David Okonkwo", age: 53, bed: "B-11", ward: "ICU-3A", status: "Stable", doctor: "Dr. Lisa Wong" },
];

// For demo, all patients resolve to the same mock data
export const getPatientById = (id: string): Patient | undefined => {
  const summary = mockPatientsList.find((p) => p.id === id);
  if (!summary) return undefined;
  return { ...mockPatient, name: summary.name, age: summary.age, bed: summary.bed, doctor: summary.doctor, ward: summary.ward, status: summary.status };
};
