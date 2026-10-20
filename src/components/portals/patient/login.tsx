"use client";
/**
 * Patient portal — demo login: pick a record from /api/patient/login-options
 * (name + MRN + masked phone), then setPatient() to open the session.
 */
import { apiGet } from "@/lib/api-client";
import { useApp } from "@/store/app";
import { useI18n, bi } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBox } from "./parts";
import { maskPhone, useFetch, type LoginOption } from "./lib";
import { HeartPulse, LogIn, Phone } from "lucide-react";

export default function LoginScreen() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const setPatient = useApp((s) => s.setPatient);
  const { data, loading, error, reload } = useFetch<LoginOption[]>(() => apiGet<LoginOption[]>("/api/patient/login-options"));

  const enter = async (row: LoginOption) => {
    // optimistic session (id + mrn + names) — overview fetch refines it right after
    useApp.getState().setPatient({ patientId: row.id, mrn: row.mrn, nameAr: row.nameAr, nameEn: row.nameEn });
    try {
      const { patient } = await apiGet<{ patient: { nameAr: string; nameEn: string } }>("/api/patient/overview");
      if (patient?.nameEn) useApp.getState().setPatient({ patientId: row.id, mrn: row.mrn, nameAr: patient.nameAr, nameEn: patient.nameEn });
    } catch {
      toast({ title: t("common.error"), description: t("common.retry"), variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <header className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg" aria-hidden>
          <HeartPulse className="size-8" />
        </span>
        <h1 className="text-2xl font-bold">{t("pp.login.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pp.login.subtitle")}</p>
      </header>

      {loading ? (
        <div className="grid gap-3" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <ul className="grid gap-3" role="list">
          {(data ?? []).map((row) => (
            <li key={row.id}>
              <Card className="py-0 transition-shadow hover:shadow-md">
                <CardContent className="p-0">
                  <Button
                    variant="ghost"
                    onClick={() => enter(row)}
                    className="flex h-auto w-full flex-col items-start gap-1.5 rounded-xl p-4 text-start"
                    aria-label={`${t("pp.login.select")} — ${bi(lang, row.nameAr, row.nameEn)}`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-base font-semibold">{bi(lang, row.nameAr, row.nameEn)}</span>
                      <LogIn className="size-4 shrink-0 text-primary" aria-hidden />
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono" dir="ltr">{row.mrn}</span>
                      <span className="flex items-center gap-1" dir="ltr"><Phone className="size-3" aria-hidden />{maskPhone(row.phone)}</span>
                    </span>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
