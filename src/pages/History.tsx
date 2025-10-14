import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Calendar, TrendingUp, AlertTriangle, Eye } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Report {
  id: string;
  date: string;
  topCondition: string;
  confidence: number;
  riskLevel: string;
}

const History = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [filterRisk, setFilterRisk] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Mock data for demonstration
      // In production, this would fetch from the database
      setReports([
        {
          id: "rep-001",
          date: "2025-01-15",
          topCondition: "Actinic Keratosis",
          confidence: 78,
          riskLevel: "Low"
        },
        {
          id: "rep-002",
          date: "2025-01-10",
          topCondition: "Melanoma",
          confidence: 65,
          riskLevel: "High"
        },
        {
          id: "rep-003",
          date: "2025-01-05",
          topCondition: "Seborrheic Keratosis",
          confidence: 82,
          riskLevel: "Low"
        },
        {
          id: "rep-004",
          date: "2024-12-28",
          topCondition: "Basal Cell Carcinoma",
          confidence: 71,
          riskLevel: "Moderate"
        },
      ]);
      
      setLoading(false);
    };
    
    checkAuth();
  }, [navigate]);

  const filteredReports = reports.filter(report => {
    if (filterRisk !== "all" && report.riskLevel !== filterRisk) return false;
    if (filterDate === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(report.date) >= weekAgo;
    }
    if (filterDate === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(report.date) >= monthAgo;
    }
    return true;
  });

  // Chart data
  const conditionCounts = filteredReports.reduce((acc, report) => {
    acc[report.topCondition] = (acc[report.topCondition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barChartData = Object.entries(conditionCounts).map(([name, value]) => ({
    name: name.length > 15 ? name.substring(0, 15) + "..." : name,
    count: value
  }));

  const riskCounts = filteredReports.reduce((acc, report) => {
    acc[report.riskLevel] = (acc[report.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.entries(riskCounts).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = {
    'Low': '#8BA38A',
    'Moderate': '#F59E0B',
    'High': '#EF4444'
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="medical-container py-8 max-w-7xl">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Reports History</h1>
          <p className="text-muted-foreground">
            View and analyze your past diagnostic reports
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-4 mb-6 animate-fade-in">
          <Card className="medical-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{reports.length}</div>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                High Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">
                {reports.filter(r => r.riskLevel === "High").length}
              </div>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Moderate Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">
                {reports.filter(r => r.riskLevel === "Moderate").length}
              </div>
            </CardContent>
          </Card>
          <Card className="medical-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {reports.filter(r => r.riskLevel === "Low").length}
              </div>
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
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4D9DE0" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="medical-card animate-fade-in" style={{ animationDelay: "200ms" }}>
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Breakdown by risk level</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
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
                <Select value={filterRisk} onValueChange={setFilterRisk}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risks</SelectItem>
                    <SelectItem value="High">High risk</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Low">Low risk</SelectItem>
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
                  <p>No reports match the selected filters</p>
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
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        report.riskLevel === "High" ? "bg-destructive/10" :
                        report.riskLevel === "Moderate" ? "bg-warning/10" :
                        "bg-success/10"
                      }`}>
                        {report.riskLevel === "High" ? (
                          <AlertTriangle className="h-6 w-6 text-destructive" />
                        ) : (
                          <TrendingUp className="h-6 w-6 text-success" />
                        )}
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
                      <Badge variant={
                        report.riskLevel === "High" ? "destructive" :
                        report.riskLevel === "Moderate" ? "default" :
                        "secondary"
                      }>
                        {report.riskLevel} Risk
                      </Badge>
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
