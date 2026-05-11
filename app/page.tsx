import Image from "next/image";
import { CheckCircle2, FileText, ShieldCheck, type LucideIcon } from "lucide-react";
import { LandingBackdrop } from "@/components/landing/landing-backdrop";
import { LandingRedirect } from "@/components/landing/landing-redirect";
import { SignInCTA } from "@/components/landing/sign-in-cta";
import { cn } from "@/lib/utils";

// AGM cycle year. Lives here as a single named constant so next year's
// committee changes one value and rebuilds. The landing is intentionally
// static because it renders before the auth handshake and changes once a year.
const AGM_CYCLE_YEAR = 2026;

const SYSTEM_POINTS = [
  {
    label: "01",
    title: "Internal evaluation",
    body: "Rubric scores stay complete-or-empty before they enter the result.",
  },
  {
    label: "02",
    title: "Live AGM ballot",
    body: "Eligible students cast one ballot per active position during the room session.",
  },
  {
    label: "03",
    title: "Published record",
    body: "Final weightage and tie decisions remain visible after the cycle closes.",
  },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <LandingRedirect />
      <LandingBackdrop />

      <div className="relative z-10 flex min-h-dvh flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="grid gap-3 border-b border-[var(--ink-line)] pb-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-muted)] md:block">
            Official election surface
          </p>
          <BrandPill year={AGM_CYCLE_YEAR} />
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-muted)] md:text-right">
            @student.usm.my only
          </p>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:gap-6 lg:py-6">
          <LandingPanel className="relative overflow-hidden bg-[var(--paper)]/88 px-5 py-6 sm:px-8 sm:py-8 lg:min-h-[36rem] lg:px-10 lg:py-10">
            <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-[var(--ink-line)] lg:block" />
            <div className="absolute right-11 top-11 hidden h-16 w-16 rounded-full border border-[var(--copper)]/55 lg:block" />

            <div className="flex h-full flex-col justify-between gap-14">
              <div className="max-w-[46rem]">
                <SectionKicker primary="USM CSS AGM" secondary={`${AGM_CYCLE_YEAR} register`} />
                <h1 className="mt-8 max-w-[12ch] font-serif text-[clamp(3rem,9vw,7.6rem)] font-medium leading-[0.9] tracking-[-0.025em] text-[var(--ink)]">
                  Elect with evidence.
                </h1>
                <p className="mt-7 max-w-[44rem] font-mono text-sm leading-7 text-[var(--ink-muted)] sm:text-[15px]">
                  The Computer Science Society AGM portal records internal
                  evaluation, live voting, and the published result as one
                  auditable civic workflow.
                </p>
              </div>

              <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="flex flex-col items-start gap-4">
                  <SignInCTA />
                  <p className="max-w-[34rem] font-mono text-[10.5px] uppercase leading-5 tracking-[0.22em] text-[var(--ink-muted)]">
                    Sign in with your USM student email. Authenticated visitors
                    continue through the role-aware dashboard.
                  </p>
                </div>

                <div className="grid w-full max-w-[22rem] grid-cols-3 border-y border-[var(--ink-line)] lg:w-[22rem]">
                  <Metric label="Cycle" value={AGM_CYCLE_YEAR} />
                  <Metric label="Mode" value="AGM" />
                  <Metric label="Record" value="Audit" />
                </div>
              </div>
            </div>
          </LandingPanel>

          <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <LandingPanel className="relative min-h-[16rem] overflow-hidden bg-[var(--ink)] px-5 py-5 text-[var(--paper)] sm:col-span-2 lg:col-span-1">
              <div className="absolute inset-0 opacity-35 mix-blend-screen">
                <Image
                  src="/landing/sumi-backdrop.png"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 38vw, 100vw"
                  className="object-cover object-[72%_30%]"
                />
              </div>
              <div className="relative flex h-full min-h-[14rem] flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <Image
                    src="/logos/cs-soc-official-white.svg"
                    alt=""
                    width={46}
                    height={46}
                    priority
                    className="h-[46px] w-[46px]"
                    aria-hidden
                  />
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper)]/68">
                    Identity / 01
                  </p>
                </div>
                <div>
                  <p className="max-w-[16rem] font-display text-2xl font-medium leading-none tracking-[-0.03em]">
                    A register, not a poll.
                  </p>
                  <p className="mt-3 max-w-[25rem] font-mono text-[11px] leading-5 text-[var(--paper)]/68">
                    The official mark sits inside a quiet election system:
                    restrained, inspectable, and built for the annual handover.
                  </p>
                </div>
              </div>
            </LandingPanel>

            <LandingPanel className="bg-[var(--paper-2)]/88 p-5">
              <SectionKicker primary="Method" secondary="Three records" />
              <div className="mt-5 grid gap-4">
                {SYSTEM_POINTS.map((point) => (
                  <div
                    key={point.label}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-t border-[var(--ink-line)] pt-4"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--copper)]">
                      {point.label}
                    </span>
                    <div>
                      <h2 className="font-display text-base font-medium tracking-[-0.02em] text-[var(--ink)]">
                        {point.title}
                      </h2>
                      <p className="mt-1 font-mono text-[11px] leading-5 text-[var(--ink-muted)]">
                        {point.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </LandingPanel>

            <LandingPanel className="grid min-h-[16rem] grid-rows-[auto_1fr_auto] bg-[var(--paper)]/86 p-5">
              <SectionKicker primary="System" secondary="Trust signals" />
              <div className="grid place-items-center py-7">
                <div className="relative grid h-36 w-36 place-items-center rounded-full border border-[var(--ink-line)]">
                  <div className="absolute h-px w-[11rem] bg-[var(--ink-line)]" />
                  <div className="absolute h-[11rem] w-px bg-[var(--ink-line)]" />
                  <div className="grid h-24 w-24 place-items-center rounded-full border border-[var(--copper)]/60 bg-[var(--paper-2)]">
                    <ShieldCheck className="h-9 w-9 text-[var(--ink)]" strokeWidth={1.6} />
                  </div>
                </div>
              </div>
              <div className="grid gap-2 border-t border-[var(--ink-line)] pt-4">
                <TrustRow icon={CheckCircle2} label="One vote per active position" />
                <TrustRow icon={FileText} label="Weightage visible at publication" />
              </div>
            </LandingPanel>
          </aside>
        </section>

        <footer className="grid gap-3 border-t border-[var(--ink-line)] pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)] sm:grid-cols-[1fr_auto]">
          <p>USM Computer Science Society</p>
          <p>Annual General Meeting {AGM_CYCLE_YEAR}</p>
        </footer>
      </div>
    </main>
  );
}

interface BrandPillProps {
  year: number;
}

function BrandPill({ year }: BrandPillProps) {
  return (
    <div className="inline-flex w-fit items-center gap-2.5 justify-self-start rounded-full border border-[var(--ink)] bg-[var(--paper)]/90 px-4 py-2 md:justify-self-center">
      <Image
        src="/logos/cs-soc-official.svg"
        alt=""
        width={20}
        height={20}
        priority
        className="h-[20px] w-[20px]"
        aria-hidden
      />
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-[var(--ink)]">
        USM CSS AGM <span className="text-[var(--copper)]">·</span> {year}
      </span>
    </div>
  );
}

function LandingPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border border-[var(--ink-line)] shadow-[0_24px_70px_-48px_rgba(11,15,18,0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionKicker({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-muted)]">
      {primary} <span className="text-[var(--copper)]">·</span> {secondary}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-r border-[var(--ink-line)] px-3 py-3 last:border-r-0">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-2 font-display text-sm font-medium text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}

function TrustRow({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2 font-mono text-[11px] text-[var(--ink-muted)]">
      <Icon className="h-4 w-4 text-[var(--ink)]" strokeWidth={1.8} />
      <span>{label}</span>
    </div>
  );
}
