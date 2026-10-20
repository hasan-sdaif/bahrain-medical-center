"use client";
/** Doctors directory — filter by dept/language/gender; cards with credentials,
 *  license, languages, bio, a demo "next slot" chip and a booking CTA. */
import { useMemo, useState } from "react";
import { BadgeCheck, CalendarCheck, Languages, ShieldCheck, Stethoscope, UserRoundSearch } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bi, useI18n } from "@/i18n";
import { usePublicData, type DoctorDto } from "../data";
import { useBooking } from "./booking";
import { EmptyState, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

const ALL = "__all__";

function initials(name: string): string {
  const parts = name.replace(/^(د\.|Dr\.)\s*/u, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function DoctorCard({ doc }: { doc: DoctorDto }) {
  const { lang, t } = useI18n();
  const openBooking = useBooking((c) => c.openBooking);
  return (
    <Card className="flex flex-col">
      <CardContent className="p-4 md:p-5 flex-1">
        <div className="flex items-start gap-3">
          <Avatar className="size-12 border">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(lang === "ar" ? doc.nameAr : doc.nameEn)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-snug">{bi(lang, doc.nameAr, doc.nameEn)}</h3>
            <p className="text-sm text-primary font-medium">{bi(lang, doc.specialtyAr, doc.specialtyEn)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{bi(lang, doc.deptAr, doc.deptEn)}</p>
          </div>
        </div>

        {bi(lang, doc.credentialsAr, doc.credentialsEn) ? (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <BadgeCheck className="size-3.5 shrink-0 mt-0.5 text-primary" aria-hidden />
            <span>{bi(lang, doc.credentialsAr, doc.credentialsEn)}</span>
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal">
            <ShieldCheck className="size-3" aria-hidden />
            {t("public.docs.license")} <span dir="ltr" className="font-mono">{doc.licenseNo ?? "—"}</span>
          </Badge>
          {doc.languages.map((l) => (
            <Badge key={l} variant="outline" className="gap-1 font-normal">
              <Languages className="size-3" aria-hidden />
              {l === "ar" ? t("public.docs.lang.arabic") : l === "en" ? t("public.docs.lang.english") : l}
            </Badge>
          ))}
        </div>

        {bi(lang, doc.bioAr, doc.bioEn) ? (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">{bi(lang, doc.bioAr, doc.bioEn)}</p>
        ) : null}
      </CardContent>
      <CardFooter className="p-4 md:p-5 pt-0 flex items-center justify-between gap-2 flex-wrap">
        <Badge className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-transparent gap-1.5" title={t("public.docs.next")}>
          <CalendarCheck className="size-3.5" aria-hidden />
          {t("public.docs.next")}: {t("public.docs.next.demo")}
        </Badge>
        <Button size="sm" className="h-9" onClick={() => openBooking({ deptCode: doc.deptCode, doctorId: doc.id })}>
          {t("public.docs.book")}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function Doctors() {
  const { lang, t } = useI18n();
  const { data, loading, error, reload } = usePublicData();
  const [dept, setDept] = useState<string>(ALL);
  const [language, setLanguage] = useState<string>(ALL);
  const [gender, setGender] = useState<string>(ALL);

  const doctors = useMemo(
    () => data.doctors.filter((d) =>
      d.deptCode &&
      (dept === ALL || d.deptCode === dept) &&
      (language === ALL || d.languages.includes(language)) &&
      (gender === ALL || d.gender === gender)),
    [data.doctors, dept, language, gender],
  );

  const trigger = "h-11 w-full sm:w-44 justify-between font-normal";

  return (
    <Section id="doctors" className="bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        <SectionHeader icon={Stethoscope} title={t("public.docs.title")} subtitle={t("public.docs.subtitle")} />

        <div className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger aria-label={t("public.docs.filter.dept")} className={trigger}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("public.docs.filter.dept")} — {t("common.all")}</SelectItem>
              {data.departments.map((d) => (
                <SelectItem key={d.code} value={d.code}>{bi(lang, d.nameAr, d.nameEn)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger aria-label={t("public.docs.filter.lang")} className={trigger}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("public.docs.filter.lang")} — {t("common.all")}</SelectItem>
              <SelectItem value="ar">{t("public.docs.lang.arabic")}</SelectItem>
              <SelectItem value="en">{t("public.docs.lang.english")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger aria-label={t("public.docs.filter.gender")} className={trigger}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("public.docs.filter.gender")} — {t("common.all")}</SelectItem>
              <SelectItem value="female">{t("common.female")}</SelectItem>
              <SelectItem value="male">{t("common.male")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error ? <ErrorRetry onRetry={reload} />
          : loading ? <SectionSkeleton cards={8} />
            : doctors.length === 0 ? (
              <EmptyState icon={UserRoundSearch} title={t("public.docs.empty")} />
            ) : (
              <>
                <p className="mb-3 text-center text-sm text-muted-foreground">{t("public.docs.count", { n: doctors.length })}</p>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {doctors.map((d) => <DoctorCard key={d.id} doc={d} />)}
                </div>
              </>
            )}
      </div>
    </Section>
  );
}
