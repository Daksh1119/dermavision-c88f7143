import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { DiseaseStatsResult } from "@/lib/getDiseaseStats";

interface Props {
  stats: DiseaseStatsResult | null;
  loading: boolean;
  error: string | null;
  condition?: string;
}

export const DiseaseStatsCard = ({ stats, loading, error, condition }: Props) => {
  return (
    <Card className="medical-card animate-fade-in" style={{ animationDelay: "60ms" }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          India Prevalence Snapshot
        </CardTitle>
        <CardDescription>
          Indicative, AI-synthesized epidemiology style data (not official statistics)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && stats && stats.data.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  label={{ value: "Cases", angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: "% Prev", angle: -90, position: "insideRight", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: any, name: any) => [value, name === "prevalence_rate" ? "% Prev" : "Cases"]}
                />
                <Bar yAxisId="left" dataKey="cases" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar
                  yAxisId="right"
                  dataKey="prevalence_rate"
                  fill="hsl(var(--accent))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid sm:grid-cols-2 gap-3">
              {stats.data.map(row => (
                <div
                  key={row.state}
                  className="border rounded-md p-3 flex flex-col gap-1 bg-muted/30 text-xs"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{row.state}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {row.prevalence_rate.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cases:</span>
                    <span className="font-medium">{row.cases.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Age Group:</span>
                    <span>{row.age_group}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
              These figures are indicative only (AI-generated or estimated) and NOT official public
              health statistics. Always consult authenticated sources for epidemiological data.
            </p>
          </>
        )}

        {!loading && !error && (!stats || stats.data.length === 0) && (
          <p className="text-muted-foreground text-sm">
            No prevalence snapshot available for {condition || "this condition"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
};