import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Plus, Trash2, RefreshCw } from "lucide-react";
import { PatientInputCell } from "@/components/PatientInputCell";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPatients, createPatient, PatientResponse } from "@/lib/api/patients";

type PatientStatus = "Stable" | "Critical" | "Watchlist";

/** Maps backend status strings to the UI status type. */
function toUiStatus(raw: string | null | undefined): PatientStatus {
  const STATUS_MAP: Record<string, PatientStatus> = {
    active: "Stable",
    stable: "Stable",
    critical: "Critical",
    watchlist: "Watchlist",
  };
  return STATUS_MAP[raw?.toLowerCase() ?? ""] ?? "Stable";
}

const STATUS_COLORS: Record<PatientStatus, string> = {
  Critical: "bg-destructive/15 text-destructive border-destructive/30",
  Watchlist: "bg-warning/15 text-warning border-warning/30",
  Stable: "bg-success/15 text-success border-success/30",
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const Index = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add patient form state
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newBed, setNewBed] = useState("");
  const [newAdmissionReason, setNewAdmissionReason] = useState("");
  const [newStatus, setNewStatus] = useState<PatientStatus>("Stable");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);

  const fetchPatients = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listPatients();
      setPatients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    // Optimistic local removal (no DELETE endpoint on backend currently)
    setPatients((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  };

  const addPatient = async (): Promise<void> => {
    if (!newName.trim()) return;
    try {
      const created = await createPatient({
        name: newName.trim(),
        age: parseInt(newAge) || undefined,
        bed_number: newBed.trim() || undefined,
        admission_reason: newAdmissionReason.trim() || undefined,
        status: newStatus.toLowerCase(),
      });
      setPatients((prev) => [created, ...prev]);
      setNewName("");
      setNewAge("");
      setNewBed("");
      setNewAdmissionReason("");
      setNewStatus("Stable");
      setIsAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add patient");
    }
  };

  return (
    <Layout>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-muted-foreground font-body mb-1 uppercase tracking-widest">
            City General Hospital · ICU-3A Ward Display
          </p>

          {/* Greeting */}
          <div className="mt-6 mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-3xl text-foreground">{greeting}, Doctor</h2>
              <p className="text-muted-foreground font-body mt-1">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchPatients}
              disabled={isLoading}
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-body">
              {error}
            </div>
          )}

          {/* Patient Table */}
          <Card className="animate-fade-in">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground font-body text-sm">
                  Loading patients…
                </div>
              ) : patients.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-body text-sm">
                  No patients found. Add the first patient below.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40">
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Patient ID</TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Name</TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Age</TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Bed</TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Admission</TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-body font-semibold text-foreground">Input</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((p) => {
                      const uiStatus = toUiStatus(p.status);
                      return (
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-secondary/30 transition-colors"
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleSelect(p.id)}
                              className="rounded border-border accent-primary h-4 w-4"
                            />
                          </TableCell>
                          <TableCell
                            className="font-mono text-sm text-muted-foreground"
                            onClick={() => navigate(`/patient/${p.id}`)}
                          >
                            P-{p.id}
                          </TableCell>
                          <TableCell
                            className="font-body font-medium text-foreground"
                            onClick={() => navigate(`/patient/${p.id}`)}
                          >
                            {p.name}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/patient/${p.id}`)}>
                            {p.age ?? "—"}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/patient/${p.id}`)}>
                            {p.bed_number ?? "—"}
                          </TableCell>
                          <TableCell
                            className="text-sm max-w-[180px] truncate"
                            onClick={() => navigate(`/patient/${p.id}`)}
                          >
                            {p.admission_reason ?? "—"}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/patient/${p.id}`)}>
                            <Badge variant="outline" className={STATUS_COLORS[uiStatus]}>
                              {uiStatus}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <PatientInputCell patientId={String(p.id)} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus size={16} />
                  Add Patient
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">Add New Patient</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div>
                    <Label className="font-body text-sm">Name *</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-body text-sm">Age</Label>
                      <Input
                        type="number"
                        value={newAge}
                        onChange={(e) => setNewAge(e.target.value)}
                        placeholder="Age"
                      />
                    </div>
                    <div>
                      <Label className="font-body text-sm">Bed</Label>
                      <Input
                        value={newBed}
                        onChange={(e) => setNewBed(e.target.value)}
                        placeholder="e.g. B-01"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="font-body text-sm">Admission Reason</Label>
                    <Input
                      value={newAdmissionReason}
                      onChange={(e) => setNewAdmissionReason(e.target.value)}
                      placeholder="e.g. Acute COPD exacerbation"
                    />
                  </div>
                  <div>
                    <Label className="font-body text-sm">Status</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as PatientStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Stable">Stable</SelectItem>
                        <SelectItem value="Watchlist">Watchlist</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogClose asChild>
                    <Button className="w-full mt-2" onClick={addPatient}>
                      Add Patient
                    </Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>

            {selectedIds.size > 0 && (
              <Button variant="destructive" className="gap-2" onClick={deleteSelected}>
                <Trash2 size={16} />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
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

export default Index;
