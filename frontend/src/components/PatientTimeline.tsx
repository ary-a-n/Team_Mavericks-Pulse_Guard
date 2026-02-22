import { useState } from "react";
import { Clock, TrendingUp, ChevronDown, ChevronUp, History } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { getPatientHandoffs, HandoffResponse } from "@/lib/api/patients";

// ──────────────────────────────────────────────────────
// Types matching agent_output_json structure
// ──────────────────────────────────────────────────────

interface AgentVital {
    type: string;
    value: string;
    trend?: string;
}

interface AgentAlert {
    alert_type: string;
    severity: string;
    reason: string;
}

interface AgentHinglish {
    patient_overview?: string;
    risk_alerts?: string[];
    action_items?: string[];
    medications?: string[];
}

interface AgentOutput {
    extracted?: { vitals?: AgentVital[] };
    risks?: { overall_risk?: string; risk_score?: number; alerts?: AgentAlert[] };
    hinglish_summary?: AgentHinglish;
}

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
    CRITICAL: "bg-destructive/15 text-destructive border-destructive/30",
    HIGH: "bg-destructive/15 text-destructive border-destructive/30",
    MEDIUM: "bg-warning/15 text-warning border-warning/30",
    LOW: "bg-success/15 text-success border-success/30",
};

const RISK_DOT: Record<string, string> = {
    CRITICAL: "bg-destructive",
    HIGH: "bg-destructive",
    MEDIUM: "bg-warning",
    LOW: "bg-success",
};

function formatShift(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " · " +
        d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatChartTick(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ──────────────────────────────────────────────────────
// Risk Trajectory Chart
// ──────────────────────────────────────────────────────

interface ChartPoint {
    time: string;
    rawTime: string;
    score: number;
    risk: string;
}

function RiskChart({ points }: { points: ChartPoint[] }) {
    if (points.length < 2) return null;

    return (
        <div className="mb-6">
            <h3 className="flex items-center gap-2 text-sm font-heading font-semibold text-foreground mb-3">
                <TrendingUp size={14} className="text-primary" />
                Risk Score Trajectory
            </h3>
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                                fontSize: "12px",
                                color: "hsl(var(--foreground))",
                            }}
                            formatter={(val: number, _: string, props: { payload?: ChartPoint }) => [
                                `${val} — ${props.payload?.risk ?? ""}`,
                                "Risk Score",
                            ]}
                            labelFormatter={(label: string) => label}
                        />
                        {/* threshold lines */}
                        <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="4 2" strokeWidth={1} />
                        <ReferenceLine y={40} stroke="hsl(var(--warning))" strokeDasharray="4 2" strokeWidth={1} />
                        <Area
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#riskGrad)"
                            dot={{ r: 3, fill: "hsl(var(--primary))" }}
                            activeDot={{ r: 5 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-body">
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive" /> High risk ≥ 70
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-warning" /> Medium ≥ 40
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" /> Low &lt; 40
                </span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────
// Single timeline entry
// ──────────────────────────────────────────────────────

function TimelineEntry({
    handoff,
    index,
    isLatest,
}: {
    handoff: HandoffResponse;
    index: number;
    isLatest: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const agent = handoff.agent_output_json as AgentOutput | null;
    const risk = agent?.risks?.overall_risk ?? "LOW";
    const score = agent?.risks?.risk_score;
    const vitals = agent?.extracted?.vitals ?? [];
    const hinglish = agent?.hinglish_summary;
    const overview = hinglish?.patient_overview;
    const actionItems = hinglish?.action_items ?? [];
    const riskAlerts = hinglish?.risk_alerts ?? [];

    return (
        <div className="flex gap-4">
            {/* Rail + dot */}
            <div className="flex flex-col items-center shrink-0">
                <div
                    className={`h-3 w-3 rounded-full border-2 border-background shadow-md mt-1 ${RISK_DOT[risk] ?? "bg-muted"
                        }`}
                />
                {/* Vertical line — skip for last item */}
                {index !== 0 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                )}
            </div>

            {/* Content */}
            <div className="pb-6 flex-1 min-w-0">
                {/* Time + badges */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-body">
                        <Clock size={11} />
                        {formatShift(handoff.shift_time)}
                    </span>
                    <Badge variant="outline" className={`text-xs ${RISK_COLORS[risk] ?? ""}`}>
                        {risk}
                    </Badge>
                    {score !== undefined && (
                        <span className="text-xs text-muted-foreground font-body">
                            score: {score}
                        </span>
                    )}
                    {isLatest && (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            Latest
                        </Badge>
                    )}
                </div>

                {/* Patient overview */}
                {overview && (
                    <p className="text-sm font-body text-foreground/80 leading-relaxed mb-2">
                        {overview}
                    </p>
                )}

                {/* Vitals chips */}
                {vitals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {vitals.map((v, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 text-xs font-body text-foreground/70"
                            >
                                <span className="font-semibold text-foreground/90">{v.type}</span>
                                {v.value}
                            </span>
                        ))}
                    </div>
                )}

                {/* Risk alerts — compact pills */}
                {riskAlerts.length > 0 && (
                    <div className="flex flex-col gap-1 mb-2">
                        {riskAlerts.map((alert, i) => (
                            <span
                                key={i}
                                className="text-xs font-body text-destructive/80 pl-2 border-l-2 border-destructive/40 leading-relaxed"
                            >
                                {alert}
                            </span>
                        ))}
                    </div>
                )}

                {/* Expand/collapse action items */}
                {actionItems.length > 0 && (
                    <div>
                        <button
                            onClick={() => setExpanded((p) => !p)}
                            className="flex items-center gap-1 text-xs text-primary font-body hover:text-primary/80 transition-colors"
                        >
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expanded ? "Hide" : "Show"} {actionItems.length} action items
                        </button>
                        {expanded && (
                            <ol className="mt-2 space-y-1.5 pl-1">
                                {actionItems.map((item, i) => (
                                    <li key={i} className="text-xs font-body text-foreground/70 leading-relaxed flex gap-2">
                                        <span className="font-semibold text-primary shrink-0">{i + 1}.</span>
                                        {item}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                )}

                {/* Fallback: raw transcript */}
                {!overview && handoff.raw_transcript && (
                    <p className="text-xs font-body text-muted-foreground italic leading-relaxed line-clamp-2">
                        "{handoff.raw_transcript}"
                    </p>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────

interface PatientTimelineProps {
    patientId: number;
    patientName: string;
}

export function PatientTimeline({ patientId, patientName }: PatientTimelineProps) {
    const [handoffs, setHandoffs] = useState<HandoffResponse[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const load = async (): Promise<void> => {
        if (handoffs.length > 0) return; // already loaded
        setIsLoading(true);
        try {
            const data = await getPatientHandoffs(patientId, 20);
            // newest first (API already returns newest first, just ensure)
            setHandoffs(data);
        } catch {
            setHandoffs([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpen = (val: boolean): void => {
        setOpen(val);
        if (val) load();
    };

    // Build chart data (oldest → newest for left-to-right trend)
    const chartPoints: ChartPoint[] = [...handoffs]
        .reverse()
        .map((h) => {
            const agent = h.agent_output_json as AgentOutput | null;
            return {
                time: formatChartTick(h.shift_time),
                rawTime: h.shift_time,
                score: agent?.risks?.risk_score ?? 0,
                risk: agent?.risks?.overall_risk ?? "LOW",
            };
        });

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <History size={14} />
                    Timeline
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
                    <DialogTitle className="font-heading text-lg text-foreground flex items-center gap-2">
                        <History size={18} className="text-primary" />
                        Patient Shift Timeline
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground font-body">
                        {patientName} · {handoffs.length} shift{handoffs.length !== 1 ? "s" : ""} recorded
                    </p>
                </DialogHeader>

                <div className="overflow-y-auto h-[75vh] w-full custom-scrollbar">
                    <div className="px-6 py-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground font-body text-sm">
                                Loading timeline…
                            </div>
                        ) : handoffs.length === 0 ? (
                            <div className="flex items-center justify-center py-16 text-muted-foreground font-body text-sm">
                                No handoffs recorded yet for this patient.
                            </div>
                        ) : (
                            <div className="pb-6">
                                <RiskChart points={chartPoints} />

                                <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
                                    Shift History
                                </h3>

                                <div className="flex flex-col">
                                    {handoffs.map((h, i) => (
                                        <TimelineEntry
                                            key={h.id}
                                            handoff={h}
                                            index={i}
                                            isLatest={i === 0}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
