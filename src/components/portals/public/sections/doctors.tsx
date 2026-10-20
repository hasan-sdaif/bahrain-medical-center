"use client";
/** Doctors directory — Shamel `.doctor-card` pattern (gradient dc-photo with
 *  avatar + rating chip, dc-spec, dc-meta license/languages, book button).
 *  Filtering by dept/language/gender is preserved. */
import { useMemo, useState } from "react";
import { Languages, ShieldCheck, Star, Stethoscope, UserRoundSearch } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bi, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { usePublicData, type DoctorDto } from "../data";
import { useBooking } from "./booking";
import { Container, EmptyState, ErrorRetry, Section, SectionHeader, SectionSkeleton } from "../section-shell";

const ALL = "__all__";
const GRADS = ["var(--grad-teal)", "var(--grad-navy)", "var(--grad-gold)", "var(--grad-violet)"];
const AVS = ["av-1", "av-2", "av-3", "av-4", "av-5", "av-6", "av-7", "av-8", "av-9", "av-10"];

function initials(name: string): string {
  const parts = name.replace(/^(د\.|Dr\.)\s*/u, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function DoctorCard({ doc, idx }: { doc: DoctorDto; idx: number }) {
  const { lang, t } = useI18n();
  const openBooking = useBooking((c) => c.openBooking);
  const name = bi(lang, doc.nameAr, doc.nameEn);
  return (
    <article className="card doctor-card interactive">
      <div className="dc-photo" style={{ background: GRADS[idx % GRADS.length] }}>
        <span className={cn("avatar a-xl border-4 border-white/50", AVS[idx % AVS.length])}>
          {initials(name)}
        </span>
        <span className="dc-rating">
          <Star className="size-3" aria-hidden fill="currentColor" /> 4.9
        </span>
      </div>
      <div className="dc-body">
        <h4 className="font-bold">{name}</h4>
        <div className="dc-spec">{bi(lang, doc.specialtyAr, doc.specialtyEn) || bi(lang, doc.deptAr, doc.deptEn)}</div>
        <div className="dc-meta">
          <span>
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("public.docs.license")} <span dir="ltr" className="font-mono">{doc.licenseNo ?? "—"}</span>
          </span>
          <span>
            <Languages className="size-3.5" aria-hidden />
            {doc.languages.map((l) => (l === "ar" ? t("public.docs.lang.arabic") : l === "en" ? t("public.docs.lang.english") : l)).join(" / ")}
          </span>
        </div>
        <button
          className="btn btn-primary btn-sm mt-auto w-full"
          onClick={() => openBooking({ deptCode: doc.deptCode, doctorId: doc.id })}
        >
          {t("public.docs.book")}
        </button>
      </div>
    </article>
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

  const trigger = "h-11 w-full sm:w-48 justify-between font-normal";

  return (
    <Section id="doctors" className="alt">
      <Container>
        <SectionHeader
          icon={Stethoscope}
          eyebrow={t("public.docs.eyebrow")}
          title={t("public.docs.title")}
          subtitle={t("public.docs.subtitle")}
        />

        <div className="mb-6 flex flex-wrap items-center gap-2">
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
          <span className="ms-auto hidden text-sm font-semibold text-ink-3 sm:block">
            {t("public.docs.count", { n: doctors.length })}
          </span>
        </div>

        {error ? <ErrorRetry onRetry={reload} />
          : loading ? <SectionSkeleton cards={8} />
            : doctors.length === 0 ? (
              <EmptyState icon={UserRoundSearch} title={t("public.docs.empty")} />
            ) : (
              <div className="grid auto-260">
                {doctors.map((d, i) => <DoctorCard key={d.id} doc={d} idx={i} />)}
              </div>
            )}
      </Container>
    </Section>
  );
}
