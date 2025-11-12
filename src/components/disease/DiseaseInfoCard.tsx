import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle } from "lucide-react";
import type { DiseaseInfo } from "@/lib/getSkinDiseaseInfo";

interface Props {
  info: DiseaseInfo | null;
  loading: boolean;
  error: string | null;
  condition: string | undefined;
}

export const DiseaseInfoCard = ({ info, loading, error, condition }: Props) => {
  return (
    <Card className="medical-card animate-fade-in">
      <CardHeader>
        <CardTitle>Condition Overview</CardTitle>
        <CardDescription>
          Educational summary for the top predicted condition
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && info && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base">{info.condition}</h3>
              <Badge variant="outline" className="text-xs">
                {info.source === "openrouter" ? "AI-synthesized" : "Fallback"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">
                Description
              </p>
              <p>{info.description}</p>
            </div>
            {info.symptoms.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">
                  Common Symptoms
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {info.symptoms.map(s => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {info.causes.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">
                  Causes
                </p>
                <div className="flex flex-wrap gap-2">
                  {info.causes.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">
                Prevention & Treatment
              </p>
              <p>{info.prevention_treatment}</p>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
              <Info className="h-4 w-4 mt-0.5" />
              <span>
                Information is approximate and AI-generated. Always seek licensed
                dermatological evaluation for diagnosis or treatment decisions.
              </span>
            </div>
          </>
        )}

        {!loading && !error && !info && (
          <p className="text-muted-foreground text-sm">
            No condition information could be derived for: {condition}
          </p>
        )}
      </CardContent>
    </Card>
  );
};