import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Calendar, TrendingUp, Eye } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getConditionName } from "@/data/conditionMap"; // map internal labels

interface DiagnosisRow {
  id: string;
  created_at: string;
  top_condition: string;
  top_confidence: number;
  model_version?: string | null;
}

function displayCondition(label: string): string {
  const mapped = getConditionName(label) || label;
  if (/^class[_\- ]?\d+$/i.test(mapped)) return "Unlabeled internal class";
  return mapped;
}

const History = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<
    { id: string; date: string; topCondition: string; confidence: number }[]
  >([]);

  const [filterDate, setFilterDate] = useState("all");

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      try {
        const sb = supabase as any;
        const { data, error } = await sb
          .from("diagnoses")
          .select("id, created_at, top_condition, top_confidence")
          .order("created_at", { ascending: false });
        if (error) throw error;
        const rows: DiagnosisRow[] = (data ?? []) as DiagnosisRow[];

        const uiReports = rows.map((r) => ({
          id: r.id,
          date: r.created_at,
          topCondition: displayCondition(r.top_condition),
          confidence: Math.round((r.top_confidence ?? 0) * 100),
        }));
        setReports(uiReports);
      } catch (err: any) {
        console.error("Failed to load history:", err);
        toast.error("Failed to load history");
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const filteredReports = useMemo(() => {
    const now = new Date();
    let fromDate: Date | null = null;
    if (filterDate === "week") {
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 7);
    } else if (filterDate === "month") {
      fromDate = new Date(now);
      fromDate.setMonth(now.getMonth() - 1);
    }
    return reports.filter((report) => {
      if (fromDate && new Date(report.date) < fromDate) return false;
      return true;
    });
  }, [reports, filterDate]);

  const conditionCounts = filteredReports.reduce((acc, report) => {
    acc[report.topCondition] = (acc[report.topCondition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barChartData = Object.entries(conditionCounts).map(([name, value]) => ({
    name: name.length > 15 ? name.substring(0, 15) + "..." : name,
    count: value,
  }));

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const totalReports = reports.length;

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-7xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Reports History</h1>
          <p className="text-muted-foreground">View and analyze your past diagnostic reports</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
          <Card className="medical-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalReports}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <Card className="medical-card animate-fade-in" style={{ animationDelay: "100ms" }}>
            <CardHeader>
              <CardTitle>Condition Frequency</CardTitle>
              <CardDescription>Number of occurrences by condition</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4D9DE0" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="medical-card animate-fade-in" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle>All Reports (compact)</CardTitle>
              <CardDescription>Click any report to view details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredReports.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => navigate(`/report/${r.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{r.topCondition}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.date).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>{r.confidence}% confidence</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Report</Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredReports.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No reports match the selected range</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="medical-card animate-fade-in" style={{ animationDelay: "300ms" }}>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>All Reports</CardTitle>
                <CardDescription>Click any report to view details</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="week">Past week</SelectItem>
                    <SelectItem value="month">Past month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredReports.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reports available</p>
                </div>
              ) : (
                filteredReports.map((report, idx) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary hover:shadow-md transition-all cursor-pointer"
                    onClick={() => navigate(`/report/${report.id}`)}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{report.topCondition}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(report.date).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>{report.confidence}% confidence</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">Report</Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default History;