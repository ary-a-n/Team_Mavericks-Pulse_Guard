import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Plus, Trash2 } from "lucide-react";
import { mockPatientsList, PatientSummary } from "@/data/mockPatients";
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

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const statusColor = (s: PatientSummary["status"]) => {
  switch (s) {
    case "Critical":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "Watchlist":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-success/15 text-success border-success/30";
  }
};

const Index = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientSummary[]>(mockPatientsList);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Add patient form state
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newBed, setNewBed] = useState("");
  const [newDoctor, setNewDoctor] = useState("");
  const [newStatus, setNewStatus] = useState<PatientSummary["status"]>("Stable");

  const greeting = useMemo(() => getGreeting(), []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = () => {
    setPatients((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  };

  const addPatient = () => {
    if (!newName.trim()) return;
    const id = `P-${1000 + patients.length + 1}`;
    setPatients((prev) => [
      ...prev,
      {
        id,
        name: newName.trim(),
        age: parseInt(newAge) || 0,
        bed: newBed.trim() || "—",
        ward: "ICU-3A",
        status: newStatus,
        doctor: newDoctor.trim() || "—",
      },
    ]);
    setNewName("");
    setNewAge("");
    setNewBed("");
    setNewDoctor("");
    setNewStatus("Stable");
  };

  return (
    <Layout>
      <div className="px-4 py-6 lg:px-8 lg:py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-muted-foreground font-body mb-1 uppercase tracking-widest">
            City General Hospital · ICU-3A Ward Display
          </p>

          {/* Greeting */}
          <div className="mt-6 mb-8">
            <h2 className="font-heading text-3xl text-foreground">{greeting}, Doctor</h2>
            <p className="text-muted-foreground font-body mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Patient Table */}
          <Card className="animate-fade-in">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Patient ID</TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Name</TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Age</TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Bed</TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Doctor</TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-body font-semibold text-foreground">Input</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((p) => (
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
                        {p.id}
                      </TableCell>
                      <TableCell
                        className="font-body font-medium text-foreground"
                        onClick={() => navigate(`/patient/${p.id}`)}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell onClick={() => navigate(`/patient/${p.id}`)}>{p.age}</TableCell>
                      <TableCell onClick={() => navigate(`/patient/${p.id}`)}>{p.bed}</TableCell>
                      <TableCell className="text-sm" onClick={() => navigate(`/patient/${p.id}`)}>{p.doctor}</TableCell>
                      <TableCell onClick={() => navigate(`/patient/${p.id}`)}>
                        <Badge variant="outline" className={statusColor(p.status)}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <PatientInputCell patientId={p.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5">
            <Dialog>
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
                    <Label className="font-body text-sm">Name</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-body text-sm">Age</Label>
                      <Input type="number" value={newAge} onChange={(e) => setNewAge(e.target.value)} placeholder="Age" />
                    </div>
                    <div>
                      <Label className="font-body text-sm">Bed</Label>
                      <Input value={newBed} onChange={(e) => setNewBed(e.target.value)} placeholder="e.g. B-01" />
                    </div>
                  </div>
                  <div>
                    <Label className="font-body text-sm">Doctor</Label>
                    <Input value={newDoctor} onChange={(e) => setNewDoctor(e.target.value)} placeholder="Attending doctor" />
                  </div>
                  <div>
                    <Label className="font-body text-sm">Status</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as PatientSummary["status"])}>
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
                    <Button className="w-full mt-2" onClick={addPatient}>Add Patient</Button>
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
