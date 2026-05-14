"use client";

import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Eye,
  FileCheck2,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  MonitorCheck,
  Play,
  Scale,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Vote,
} from "lucide-react";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { cn } from "@/lib/utils";

type SlideId =
  | "opening"
  | "users"
  | "cycle"
  | "admin"
  | "setup"
  | "internal"
  | "ballot"
  | "weights"
  | "method"
  | "transparency"
  | "close";

interface SlideDef {
  id: SlideId;
  marker: string;
  title: string;
  render: () => ReactNode;
}

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const SLIDES: SlideDef[] = [
  {
    id: "opening",
    marker: "Meeting brief",
    title: "How the AGM election portal works",
    render: () => <OpeningSlide />,
  },
  {
    id: "users",
    marker: "Who sees what",
    title: "Four roles, one official record",
    render: () => <UsersSlide />,
  },
  {
    id: "cycle",
    marker: "Election cycle",
    title: "The system moves in controlled phases",
    render: () => <CycleSlide />,
  },
  {
    id: "admin",
    marker: "Admin dashboard",
    title: "Operators run the meeting from one command surface",
    render: () => <AdminDashboardSlide />,
  },
  {
    id: "setup",
    marker: "Before voting",
    title: "Setup locks the candidate slate and evaluator access",
    render: () => <SetupSlide />,
  },
  {
    id: "internal",
    marker: "Internal evaluation",
    title: "Year 2 input is collected before the live AGM",
    render: () => <InternalSlide />,
  },
  {
    id: "ballot",
    marker: "Live ballot",
    title: "Members cast one final vote per open position",
    render: () => <BallotSlide />,
  },
  {
    id: "weights",
    marker: "Finalise 01",
    title: "Confirm class weights for this term",
    render: () => <WeightsSlide />,
  },
  {
    id: "method",
    marker: "Finalise 02",
    title: "Confirm how the final score is calculated",
    render: () => <CalculationSlide />,
  },
  {
    id: "transparency",
    marker: "Finalise 03",
    title: "Confirm what becomes visible after publishing",
    render: () => <TransparencySlide />,
  },
  {
    id: "close",
    marker: "Meeting decision",
    title: "What the room needs to agree before AGM day",
    render: () => <CloseSlide />,
  },
];

const totalSlides = SLIDES.length;

export function MeetingGuide() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hashReady, setHashReady] = useState(false);
  const activeSlide = SLIDES[activeIndex] ?? SLIDES[0]!;

  const goTo = useCallback((nextIndex: number) => {
    setActiveIndex(Math.min(Math.max(nextIndex, 0), totalSlides - 1));
  }, []);

  const goNext = useCallback(() => {
    goTo(activeIndex + 1);
  }, [activeIndex, goTo]);

  const goPrev = useCallback(() => {
    goTo(activeIndex - 1);
  }, [activeIndex, goTo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, totalSlides - 1));
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      }

      if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(totalSlides - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const initialHashIndex = slideIndexFromHash(window.location.hash);
    if (initialHashIndex !== null) {
      setActiveIndex(initialHashIndex);
    }
    setHashReady(true);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveIndex(slideIndexFromHash(window.location.hash) ?? 0);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!hashReady) return;
    const hash = `#${activeSlide.id}`;
    if (window.location.hash === hash) return;
    window.history.replaceState(null, "", hash);
  }, [activeSlide.id, hashReady]);

  const progress = ((activeIndex + 1) / totalSlides) * 100;

  return (
    <main className="agm-guide-deck min-h-dvh overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <style>{`body:has(.agm-guide-deck) nextjs-portal { display: none !important; }`}</style>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--ink-line)] bg-[color-mix(in_oklab,var(--paper)_94%,transparent)] backdrop-blur-sm">
        <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              USM CSS AGM Election
            </p>
            <p className="truncate font-display text-sm font-medium tracking-normal text-[var(--ink)]">
              {activeSlide.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.65rem] tabular-nums text-[var(--ink-muted)]">
              {String(activeIndex + 1).padStart(2, "0")} /{" "}
              {String(totalSlides).padStart(2, "0")}
            </span>
            <div className="hidden items-center gap-1 sm:flex">
              <IconButton
                label="Previous slide"
                onClick={goPrev}
                disabled={activeIndex === 0}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton
                label="Next slide"
                onClick={goNext}
                disabled={activeIndex === totalSlides - 1}
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          </div>
        </div>
        <div className="h-px bg-[var(--ink-line)]">
          <div
            className="h-full bg-[var(--teal)] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <SlideFrame key={activeSlide.id} slide={activeSlide} index={activeIndex} />
    </main>
  );
}

function slideIndexFromHash(hash: string) {
  const cleanHash = hash.replace(/^#/, "");
  const byId = SLIDES.findIndex((slide) => slide.id === cleanHash);
  if (byId >= 0) return byId;

  const byNumber = Number.parseInt(cleanHash, 10);
  if (Number.isFinite(byNumber) && byNumber >= 1 && byNumber <= totalSlides) {
    return byNumber - 1;
  }

  return null;
}

function SlideFrame({ slide, index }: { slide: SlideDef; index: number }) {
  return (
    <section className="min-h-dvh px-4 pb-4 pt-[4.35rem] sm:px-6 sm:pb-6">
      <div className="mx-auto flex min-h-[calc(100dvh-5.85rem)] max-w-[92rem] flex-col">
        <div className="grid min-w-0 flex-1 gap-6 lg:grid-cols-[minmax(16rem,0.28fr)_minmax(0,1fr)]">
          <aside className="hidden border-r border-[var(--ink-line)] pr-6 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-4">
              <SectionMarker primary={slide.marker} secondary="Meeting deck" />
              <h1 className="max-w-[13ch] font-display text-[2.15rem] font-medium leading-[1.04] tracking-normal text-[var(--ink)]">
                {slide.title}
              </h1>
            </div>
            <div className="space-y-3 border-t border-[var(--ink-line)] pt-4">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
                Slide {String(index + 1).padStart(2, "0")}
              </p>
              <SlideRail activeIndex={index} />
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="mb-4 space-y-2 lg:hidden">
              <SectionMarker primary={slide.marker} secondary="Meeting deck" />
              <h1 className="max-w-full text-wrap font-display text-2xl font-medium leading-tight tracking-normal text-[var(--ink)] sm:text-3xl">
                {slide.title}
              </h1>
            </div>
            <div
              className="tile-enter flex min-h-0 min-w-0 flex-1"
              style={{ ["--index" as never]: 0 }}
            >
              {slide.render()}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SlideRail({ activeIndex }: { activeIndex: number }) {
  return (
    <ol className="grid gap-1.5" aria-label="Slides">
      {SLIDES.map((slide, index) => (
        <li key={slide.id} className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              index === activeIndex ? "bg-[var(--teal)]" : "bg-[var(--ink-line)]",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "truncate font-mono text-[0.58rem] uppercase tracking-[0.12em]",
              index === activeIndex
                ? "text-[var(--ink)]"
                : "text-[var(--ink-muted)]",
            )}
          >
            {slide.marker}
          </span>
        </li>
      ))}
    </ol>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md border border-[var(--ink-line)] text-[var(--ink)] transition-colors hover:bg-[var(--paper-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function OpeningSlide() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)]">
      <div className="flex min-h-[30rem] flex-col justify-center border-y border-[var(--ink-line)] py-8">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-[var(--copper)]">
          Meeting presentation
        </p>
        <h2 className="mt-4 max-w-[13ch] font-serif text-[4.2rem] font-semibold leading-[0.92] tracking-normal text-[var(--ink)] sm:text-[5.8rem] lg:text-[6.4rem]">
          The portal, end to end.
        </h2>
        <div className="mt-8 grid max-w-[42rem] gap-3 sm:grid-cols-3">
          <Signal label="Internal rubric" value="before AGM" />
          <Signal label="Public vote" value="live room" />
          <Signal label="Published record" value="after approval" />
        </div>
      </div>

      <div className="flex flex-col justify-center gap-4 border-y border-[var(--ink-line)] py-8">
        <DeckTicket
          number="01"
          title="Voters see only the step they need"
          icon={Vote}
        />
        <DeckTicket
          number="02"
          title="Admins control phase changes and publishing"
          icon={LayoutDashboard}
        />
        <DeckTicket
          number="03"
          title="The room confirms the rules before results go live"
          icon={FileCheck2}
        />
      </div>
    </div>
  );
}

function UsersSlide() {
  const users = [
    {
      label: "External voters",
      detail: "Complete profile, wait for live ballots, vote once per position.",
      icon: Vote,
    },
    {
      label: "Internal evaluators",
      detail: "Submit one complete rubric before the AGM voting window.",
      icon: ClipboardList,
    },
    {
      label: "Admins",
      detail: "Prepare setup, run ballots, review results, publish.",
      icon: LayoutDashboard,
    },
    {
      label: "Super admin",
      detail: "Manages privileged access and emergency audit authority.",
      icon: KeyRound,
    },
  ];

  return (
    <div className="grid w-full content-center gap-6 lg:grid-cols-4">
      {users.map((user, index) => {
        const Icon = user.icon;
        return (
          <article
            key={user.label}
            className="grid min-h-[20rem] content-between border-y border-[var(--ink-line)] py-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg tabular-nums text-[var(--ink-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--teal)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <h2 className="font-display text-2xl font-medium tracking-normal text-[var(--ink)]">
                {user.label}
              </h2>
            </div>
            <p className="max-w-[28ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {user.detail}
            </p>
          </article>
        );
      })}
    </div>
  );
}

function CycleSlide() {
  const phases = [
    { label: "Setup", icon: Settings2, body: "Cycle, positions, candidates, whitelist, rubric." },
    { label: "Internal", icon: ClipboardList, body: "Year 2 evaluators submit complete scoring." },
    { label: "Public", icon: Play, body: "Chairperson opens one ballot at a time." },
    { label: "Preview", icon: MonitorCheck, body: "Admins inspect combined results." },
    { label: "Published", icon: FileCheck2, body: "Public record becomes visible." },
  ];

  return (
    <div className="grid w-full content-center gap-8">
      <div className="relative grid gap-4 lg:grid-cols-5">
        <div className="absolute left-0 right-0 top-[3.25rem] hidden h-px bg-[var(--ink-line)] lg:block" />
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          return (
            <article
              key={phase.label}
              className="relative grid gap-4 border-y border-[var(--ink-line)] bg-[var(--paper)] py-5 lg:min-h-[22rem]"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-sm tabular-nums text-[var(--ink-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--ink-line)] bg-[var(--paper)] text-[var(--teal)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
              </div>
              <div className="mt-auto space-y-2">
                <h2 className="font-display text-xl font-medium text-[var(--ink)]">
                  {phase.label}
                </h2>
                <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  {phase.body}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="grid gap-3 border-y border-[var(--ink-line)] py-5 sm:grid-cols-3">
        <Signal label="No phase skipping" value="ordered controls" />
        <Signal label="No duplicate ballots" value="one vote per position" />
        <Signal label="No silent publishing" value="admin review first" />
      </div>
    </div>
  );
}

function AdminDashboardSlide() {
  const setupItems = [
    "Cycle, schedule, weights, rubric",
    "Positions and ballot order",
    "Candidates assigned to positions",
    "Internal evaluator whitelist",
  ];

  return (
    <div className="grid w-full gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.25fr)]">
      <section className="grid content-between gap-6 border-y border-[var(--ink-line)] py-6">
        <div className="space-y-3">
          <SectionMarker primary="Current phase" secondary="Public voting" />
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl font-medium tracking-normal text-[var(--ink)]">
              AGM 2026
            </h2>
            <StatusPill tone="success" label="Voting open" />
          </div>
          <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            One control surface shows the phase, the next action, and what still blocks publishing.
          </p>
        </div>

        <div className="grid gap-3">
          <Button className="h-11 justify-between rounded-[3px] bg-[var(--ink)] px-4 text-[var(--paper)]">
            Run live voting <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="h-11 justify-between rounded-[3px] border-[var(--ink-line)] bg-transparent px-4"
          >
            Review results <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.82fr)]">
        <div className="border-y border-[var(--ink-line)] py-6">
          <div className="flex items-center justify-between gap-3">
            <SectionMarker primary="Setup checklist" secondary="Ready" />
            <StatusPill tone="success" label="Complete" />
          </div>
          <ol className="mt-5 divide-y divide-[var(--ink-line)] border-y border-[var(--ink-line)]">
            {setupItems.map((item, index) => (
              <li
                key={item}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3"
              >
                <span className="font-mono text-sm tabular-nums text-[var(--ink-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium text-[var(--ink)]">
                  {item}
                </span>
                <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" aria-hidden />
              </li>
            ))}
          </ol>
        </div>

        <div className="grid content-between gap-5 border-y border-[var(--ink-line)] py-6">
          <div className="space-y-3">
            <SectionMarker primary="Live room" secondary="Operator panel" />
            <h3 className="font-display text-xl font-medium text-[var(--ink)]">
              Ballot control stays visible.
            </h3>
          </div>
          <div className="grid gap-3">
            <AdminMetric label="Active position" value="President" />
            <AdminMetric label="Votes received" value="118" />
            <AdminMetric label="Unresolved ties" value="0" />
          </div>
          <div className="border-t border-[var(--ink-line)] pt-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Publish remains locked until every ballot closes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SetupSlide() {
  const items = [
    { label: "Positions", value: "which roles are contested", icon: Gauge },
    { label: "Candidates", value: "name, matric, photo, positions", icon: Users },
    { label: "Whitelist", value: "who may submit internal evaluation", icon: LockKeyhole },
    { label: "Windows", value: "when internal and public phases open", icon: MonitorCheck },
  ];

  return (
    <div className="grid w-full content-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid gap-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4 border-y border-[var(--ink-line)] py-4"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--teal)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-1 font-display text-xl font-medium text-[var(--ink)]">
                  {item.label}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  {item.value}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid content-center gap-5 border-y border-[var(--ink-line)] py-7">
        <SectionMarker primary="Setup rule" secondary="Before collection" />
        <h2 className="max-w-[15ch] font-serif text-5xl font-semibold leading-[0.95] text-[var(--ink)]">
          Fix the ballot before anyone scores or votes.
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Signal label="Candidate data" value="visible on ballot" />
          <Signal label="Class access" value="gates rubric" />
          <Signal label="Schedule" value="controls phases" />
        </div>
      </div>
    </div>
  );
}

function InternalSlide() {
  return (
    <div className="grid w-full content-center gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
      <section className="border-y border-[var(--ink-line)] py-7">
        <SectionMarker primary="Internal evaluation" secondary="Complete or not counted" />
        <h2 className="mt-4 max-w-[14ch] font-serif text-5xl font-semibold leading-[0.94] text-[var(--ink)]">
          Internal input is collected before the live vote.
        </h2>
        <p className="mt-6 max-w-[54ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          The meeting does not need every member to test this path. Internal evaluators complete it earlier, and admins monitor completion from the dashboard.
        </p>
      </section>

      <section className="grid gap-4">
        <ProcessStep
          number="01"
          title="Whitelisted Year 2 members open the rubric"
          icon={LockKeyhole}
        />
        <ProcessStep
          number="02"
          title="Every active candidate must receive a full set of scores"
          icon={ClipboardList}
        />
        <ProcessStep
          number="03"
          title="Submitted rubrics lock into the combined result calculation"
          icon={BadgeCheck}
        />
      </section>
    </div>
  );
}

function BallotSlide() {
  return (
    <div className="min-w-0 w-full">
      <InteractiveBallotDemo />
    </div>
  );
}

function WeightsSlide() {
  return (
    <div className="grid w-full content-center gap-6 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
      <section className="border-y border-[var(--ink-line)] py-7">
        <SectionMarker primary="Question" secondary="Class weights" />
        <h2 className="mt-4 max-w-[12ch] font-serif text-5xl font-semibold leading-[0.94] text-[var(--ink)]">
          Which voices carry what share this term?
        </h2>
        <p className="mt-6 max-w-[44ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          The default split totals 100%. Once collection starts, changing it affects how existing inputs combine.
        </p>
      </section>

      <section className="grid content-center gap-6 border-y border-[var(--ink-line)] py-7">
        <WeightBar />
        <div className="grid gap-3 sm:grid-cols-4">
          <WeightTile label="Top Committee" value="30%" tone="copper" />
          <WeightTile label="Head Executive" value="20%" tone="teal" />
          <WeightTile label="Year 2 Committee" value="10%" tone="ink" />
          <WeightTile label="Public" value="40%" tone="muted" />
        </div>
        <div className="grid gap-3 border-t border-[var(--ink-line)] pt-5 sm:grid-cols-3">
          <DecisionCheck label="Sum is exactly 100%" />
          <DecisionCheck label="Class names match this term" />
          <DecisionCheck label="Everyone accepts the public share" />
        </div>
      </section>
    </div>
  );
}

function CalculationSlide() {
  return (
    <div className="grid w-full content-center gap-6">
      <section className="grid gap-5 border-y border-[var(--ink-line)] py-6 lg:grid-cols-[minmax(18rem,0.62fr)_minmax(0,1.38fr)]">
        <div className="space-y-4">
          <SectionMarker primary="Question" secondary="Calculation method" />
          <h2 className="max-w-[12ch] font-serif text-5xl font-semibold leading-[0.94] text-[var(--ink)]">
            Should every bucket be normalised first?
          </h2>
          <p className="max-w-[46ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Normalising each bucket means turnout differences do not silently overpower the agreed weights.
          </p>
        </div>
        <CalculationDiagram />
      </section>
    </div>
  );
}

function TransparencySlide() {
  return (
    <div className="grid w-full content-center gap-6 lg:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
      <section className="border-y border-[var(--ink-line)] py-7">
        <SectionMarker primary="Question" secondary="Published transparency" />
        <h2 className="mt-4 max-w-[13ch] font-serif text-5xl font-semibold leading-[0.94] text-[var(--ink)]">
          What should members see after publishing?
        </h2>
        <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Publishing is final. The room should agree how much breakdown is shown before the chairperson releases results.
        </p>
      </section>

      <PublishedResultMock />
    </div>
  );
}

function CloseSlide() {
  const decisions = [
    "Confirm the class weights for this term.",
    "Confirm the normalised bucket calculation method.",
    "Confirm the published breakdown level.",
  ];

  return (
    <div className="grid w-full content-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.62fr)]">
      <section className="border-y border-[var(--ink-line)] py-8">
        <SectionMarker primary="Before AGM day" secondary="Room agreement" />
        <h2 className="mt-4 max-w-[13ch] font-serif text-[4.2rem] font-semibold leading-[0.92] text-[var(--ink)] sm:text-[5.5rem]">
          Decide the rules before the room votes.
        </h2>
      </section>
      <section className="grid content-center gap-4 border-y border-[var(--ink-line)] py-8">
        {decisions.map((decision, index) => (
          <article
            key={decision}
            className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-3 border-t border-[var(--ink-line)] pt-4 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-sm tabular-nums text-[var(--ink-muted)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="text-sm font-medium leading-relaxed text-[var(--ink)]">
              {decision}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function DeckTicket({
  icon: Icon,
  number,
  title,
}: {
  icon: IconType;
  number: string;
  title: string;
}) {
  return (
    <article className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-center gap-4 border-y border-[var(--ink-line)] py-4">
      <span className="font-mono text-sm tabular-nums text-[var(--ink-muted)]">
        {number}
      </span>
      <h2 className="font-display text-lg font-medium text-[var(--ink)]">
        {title}
      </h2>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--teal)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </article>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--ink-line)] pt-3">
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.16em]",
        tone === "success" &&
          "border-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_10%,transparent)] text-[var(--color-success)]",
        tone === "warning" &&
          "border-[var(--copper)] bg-[color-mix(in_oklab,var(--copper)_10%,transparent)] text-[var(--copper)]",
        tone === "muted" &&
          "border-[var(--ink-line)] bg-transparent text-[var(--ink-muted)]",
      )}
    >
      <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
      {label}
    </span>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-t border-[var(--ink-line)] pt-3">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="font-display text-xl font-medium text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}

function ProcessStep({
  icon: Icon,
  number,
  title,
}: {
  icon: IconType;
  number: string;
  title: string;
}) {
  return (
    <article className="grid min-h-[8.5rem] grid-cols-[3rem_minmax(0,1fr)] items-start gap-4 border-y border-[var(--ink-line)] py-5">
      <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--teal)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {number}
        </p>
        <h2 className="mt-2 max-w-[36ch] font-display text-xl font-medium text-[var(--ink)]">
          {title}
        </h2>
      </div>
    </article>
  );
}

function WeightBar() {
  return (
    <div className="space-y-3">
      <div className="grid h-24 overflow-hidden rounded-[3px] border border-[var(--ink-line)] bg-[var(--paper)] [grid-template-columns:30fr_20fr_10fr_40fr]">
        <div className="grid place-items-center bg-[color-mix(in_oklab,var(--copper)_28%,var(--paper))]">
          <span className="font-mono text-sm font-semibold text-[var(--ink)]">30</span>
        </div>
        <div className="grid place-items-center bg-[color-mix(in_oklab,var(--teal)_22%,var(--paper))]">
          <span className="font-mono text-sm font-semibold text-[var(--ink)]">20</span>
        </div>
        <div className="grid place-items-center bg-[color-mix(in_oklab,var(--ink)_10%,var(--paper))]">
          <span className="font-mono text-sm font-semibold text-[var(--ink)]">10</span>
        </div>
        <div className="grid place-items-center bg-[var(--paper-2)]">
          <span className="font-mono text-sm font-semibold text-[var(--ink)]">40</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        <span>Internal 60%</span>
        <span>Public 40%</span>
      </div>
    </div>
  );
}

function WeightTile({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "copper" | "teal" | "ink" | "muted";
  value: string;
}) {
  return (
    <article className="border-t border-[var(--ink-line)] pt-4">
      <span
        className={cn(
          "mb-3 block h-2 w-10 rounded-full",
          tone === "copper" && "bg-[var(--copper)]",
          tone === "teal" && "bg-[var(--teal)]",
          tone === "ink" && "bg-[var(--ink)]",
          tone === "muted" && "bg-[var(--paper-2)] ring-1 ring-[var(--ink-line)]",
        )}
        aria-hidden
      />
      <p className="font-display text-2xl font-medium text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        {label}
      </p>
    </article>
  );
}

function DecisionCheck({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden />
      <p className="text-sm leading-relaxed text-[var(--ink)]">{label}</p>
    </div>
  );
}

function CalculationDiagram() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">
        <DiagramNode
          marker="01"
          title="Collect bucket totals"
          body="Each class and the public vote produce raw support for each candidate."
          icon={BarChart3}
        />
        <DiagramArrow />
        <DiagramNode
          marker="02"
          title="Convert to shares"
          body="Candidate support becomes a percentage inside the same bucket."
          icon={Scale}
        />
        <DiagramArrow />
        <DiagramNode
          marker="03"
          title="Apply weights"
          body="TC, HE, Y2, and Public each contribute only their agreed share."
          icon={SlidersHorizontal}
        />
        <DiagramArrow />
        <DiagramNode
          marker="04"
          title="Add the final score"
          body="Highest combined weighted score wins the position."
          icon={BadgeCheck}
        />
      </div>

      <div className="grid gap-4 border-y border-[var(--ink-line)] py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CandidateScoreVisual
          name="Candidate A"
          segments={[
            { label: "TC", width: 18, className: "bg-[var(--copper)]" },
            { label: "HE", width: 12, className: "bg-[var(--teal)]" },
            { label: "Y2", width: 7, className: "bg-[var(--ink)]" },
            { label: "Public", width: 24, className: "bg-[var(--paper-2)]" },
          ]}
          score="61.0"
        />
        <CandidateScoreVisual
          name="Candidate B"
          segments={[
            { label: "TC", width: 12, className: "bg-[var(--copper)]" },
            { label: "HE", width: 8, className: "bg-[var(--teal)]" },
            { label: "Y2", width: 6, className: "bg-[var(--ink)]" },
            { label: "Public", width: 31, className: "bg-[var(--paper-2)]" },
          ]}
          score="57.0"
        />
      </div>
    </div>
  );
}

function DiagramNode({
  body,
  icon: Icon,
  marker,
  title,
}: {
  body: string;
  icon: IconType;
  marker: string;
  title: string;
}) {
  return (
    <article className="min-h-[13rem] border-y border-[var(--ink-line)] py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm tabular-nums text-[var(--ink-muted)]">
          {marker}
        </span>
        <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--teal)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <h3 className="mt-5 font-display text-lg font-medium text-[var(--ink)]">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        {body}
      </p>
    </article>
  );
}

function DiagramArrow() {
  return (
    <div className="hidden text-[var(--ink-muted)] lg:block" aria-hidden>
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

function CandidateScoreVisual({
  name,
  score,
  segments,
}: {
  name: string;
  score: string;
  segments: { className: string; label: string; width: number }[];
}) {
  return (
    <article>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-medium text-[var(--ink)]">
          {name}
        </h3>
        <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">
          {score}
        </p>
      </div>
      <div className="mt-4 flex h-12 overflow-hidden rounded-[3px] border border-[var(--ink-line)] bg-[var(--paper)]">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={cn(
              "grid min-w-8 place-items-center border-r border-[color-mix(in_oklab,var(--paper)_65%,transparent)] last:border-r-0",
              segment.className,
            )}
            style={{ flexBasis: `${segment.width}%` }}
          >
            <span className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
              {segment.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
        Weighted contribution pieces, added left to right
      </p>
    </article>
  );
}

function PublishedResultMock() {
  return (
    <section className="grid content-center gap-5 border-y border-[var(--ink-line)] py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionMarker primary="Published results" secondary="Official record" />
        <StatusPill tone="success" label="Published" />
      </div>
      <article className="border-y border-[var(--ink-line)] py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--copper)]">
              President
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-normal text-[var(--ink)]">
              Aina Sofea
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Final score 61.0
            </p>
          </div>
          <span className="grid h-14 w-14 place-items-center rounded-full border border-[var(--color-success)] text-[var(--color-success)]">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
        </div>
      </article>

      <div className="grid gap-3 sm:grid-cols-4">
        <BreakdownShard label="TC" value="30%" />
        <BreakdownShard label="HE" value="20%" />
        <BreakdownShard label="Y2" value="10%" />
        <BreakdownShard label="Public" value="40%" />
      </div>

      <div className="grid gap-3 border-t border-[var(--ink-line)] pt-5 sm:grid-cols-3">
        <TransparencyItem icon={Eye} label="Show winner and scores" />
        <TransparencyItem icon={Scale} label="Show configured weights" />
        <TransparencyItem icon={FileCheck2} label="Show publish timestamp" />
      </div>
    </section>
  );
}

function BreakdownShard({ label, value }: { label: string; value: string }) {
  return (
    <article className="border-t border-[var(--ink-line)] pt-3">
      <p className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-medium text-[var(--ink)]">
        {value}
      </p>
    </article>
  );
}

function TransparencyItem({
  icon: Icon,
  label,
}: {
  icon: IconType;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--teal)]" aria-hidden />
      <p className="text-sm leading-relaxed text-[var(--ink)]">{label}</p>
    </div>
  );
}

type DemoCandidate = {
  candidateId: string;
  fullName: string;
  matric: string | null;
  photoUrl: string | null;
};

const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    candidateId: "candidate-a",
    fullName: "Aina Sofea",
    matric: "162482",
    photoUrl: portraitDataUrl("A", "oklch(0.64 0.08 195)", "oklch(0.9 0.03 80)"),
  },
  {
    candidateId: "candidate-b",
    fullName: "Daniel Tan",
    matric: "164219",
    photoUrl: portraitDataUrl("D", "oklch(0.68 0.09 75)", "oklch(0.92 0.025 80)"),
  },
];

function InteractiveBallotDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const chosen = useMemo(
    () => DEMO_CANDIDATES.find((candidate) => candidate.candidateId === selected),
    [selected],
  );

  if (submitted && chosen) {
    return (
      <main className="grid min-h-[calc(100dvh-6rem)] w-full content-center border-y border-[var(--ink-line)] py-8">
        <div className="mx-auto w-full max-w-[54rem] space-y-6">
          <SectionMarker primary="Live ballot" secondary="Tier 1, President" />
            <h2 className="font-display text-4xl font-medium leading-tight tracking-normal text-[var(--ink)]">
            Vote recorded
          </h2>
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--ink)]">
            Your vote for <strong className="font-semibold">{chosen.fullName}</strong>{" "}
            has been recorded for <strong className="font-semibold">President</strong>.
            This vote is final.
          </p>
          <div className="flex items-center gap-3 border-t border-[var(--ink-line)] pt-6" role="status">
            <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" aria-hidden />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
              Recorded during presentation demo
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSelected(null);
              setConfirming(false);
              setSubmitted(false);
            }}
            className="rounded-[3px] border-[var(--ink-line)] bg-transparent"
          >
            Reset demo
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[calc(100dvh-13rem)] min-h-[33rem] w-full max-w-full overflow-hidden border-y border-[var(--ink-line)] sm:h-[calc(100dvh-6rem)] sm:min-h-[34rem]">
      <section className="mx-auto flex h-[calc(100%_-_5.75rem)] w-full max-w-[94vw] min-w-0 flex-col px-3 pb-3 pt-3 sm:h-[calc(100%_-_6.25rem)] sm:px-5 sm:pt-4 lg:px-6 lg:pb-4">
        <header className="mx-auto shrink-0 text-center">
          <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.36em] text-[var(--copper)] sm:text-[0.68rem]">
            Public voting
          </p>
          <h2 className="mt-1 font-serif text-[1.75rem] font-semibold leading-[0.95] tracking-normal text-[var(--ink)] sm:text-[2.4rem] lg:text-[2.7rem]">
            Vote for President
          </h2>
          <div className="mx-auto mt-2 flex max-w-[24rem] items-center gap-3 text-[var(--copper)] sm:mt-3">
            <span className="h-px flex-1 bg-[var(--ink-line)]" />
            <Scale className="h-4 w-4 shrink-0 stroke-[1.6] sm:h-5 sm:w-5" aria-hidden />
            <span className="h-px flex-1 bg-[var(--ink-line)]" />
          </div>
          <p className="mt-2 font-serif text-[0.86rem] leading-tight text-[var(--ink)] sm:text-[0.95rem]">
            Pick exactly one (1) candidate.
          </p>
          <p className="sr-only">Tier 1, opened for the presentation demo</p>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center pt-0.5">
          <div
            role="radiogroup"
            aria-label="Candidates for President"
            className="grid w-full max-w-full justify-center gap-3 sm:gap-4 [grid-template-columns:minmax(0,min(100%,23rem))] sm:[grid-template-columns:repeat(auto-fit,minmax(clamp(19rem,22vw,25rem),clamp(21rem,25vw,27rem)))]"
          >
            {DEMO_CANDIDATES.map((candidate, idx) => (
              <CandidateBallotCard
                key={candidate.candidateId}
                candidate={candidate}
                disabled={confirming}
                index={idx}
                isSelected={selected === candidate.candidateId}
                positionName="President"
                onSelect={() => {
                  if (confirming) return;
                  setSelected(candidate.candidateId);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <SelectionDock
        chosen={chosen}
        confirming={confirming}
        submitting={false}
        onBack={() => setConfirming(false)}
        onContinue={() => setConfirming(true)}
        onSubmit={() => {
          if (!chosen) return;
          setSubmitted(true);
          setConfirming(false);
        }}
      />
    </main>
  );
}

function CandidateBallotCard({
  candidate,
  disabled,
  index,
  isSelected,
  positionName,
  onSelect,
}: {
  candidate: DemoCandidate;
  disabled: boolean;
  index: number;
  isSelected: boolean;
  positionName: string;
  onSelect: () => void;
}) {
  const matric = displayMatric(candidate.matric);
  const ticketNumber = String(index + 1).padStart(3, "0");

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${candidate.fullName}, ${positionName}`}
      disabled={disabled}
      onClick={onSelect}
      style={{ ["--index" as never]: index }}
      className={cn(
        "ticket-card tile-enter group relative grid min-h-[8.2rem] w-full grid-cols-[5.4rem_minmax(0,1fr)_2.8rem] items-center overflow-visible border-0 bg-transparent text-left",
        "px-4 py-2 shadow-none transition-[filter,transform] duration-200",
        "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)] active:scale-[0.995]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
        "disabled:cursor-not-allowed disabled:opacity-75",
        "sm:min-h-[9rem] sm:grid-cols-[7rem_minmax(0,1fr)_3.25rem] sm:px-4 sm:py-2.5",
        "lg:flex lg:h-[clamp(30rem,61vh,39rem)] lg:min-h-0 lg:flex-col lg:items-stretch lg:px-[1.3rem] lg:pb-4 lg:pt-[1.125rem]",
        isSelected
          ? "ticket-card-selected drop-shadow-[0_10px_20px_rgba(15,106,106,0.14)]"
          : "drop-shadow-[0_7px_16px_rgba(40,30,20,0.08)] hover:drop-shadow-[0_10px_18px_rgba(40,30,20,0.1)]",
      )}
    >
      <TicketBorder selected={isSelected} />
      <SelectedStamp visible={isSelected} />

      <span className="absolute left-4 top-4 z-10 hidden font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--copper)] lg:block">
        {ticketNumber}
      </span>

      <div className="relative z-10 aspect-[3/4] h-[6.6rem] justify-self-start overflow-hidden bg-[var(--paper-2)] ring-1 ring-[var(--ink-line)] sm:h-[8rem] lg:mt-[2.2rem] lg:h-auto lg:w-full">
        <CandidatePhoto
          src={candidate.photoUrl}
          alt={candidate.fullName}
          className="h-full w-full object-contain"
          iconClassName="mx-auto h-12 w-12"
          loading={index === 0 ? "eager" : "lazy"}
        />
      </div>

      <div className="relative z-10 min-w-0 self-start px-2 py-1 sm:px-4 sm:py-2 lg:px-0 lg:pb-2 lg:pt-2.5">
        <div className="mb-0.5 flex items-center gap-2 lg:hidden">
          <span className="font-mono text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-[var(--copper)] sm:text-[0.6rem]">
            {ticketNumber}
          </span>
          <span className="h-px flex-1 border-t border-dashed border-[var(--ink-line)]" />
        </div>
        <h3 className="font-serif text-[0.78rem] font-semibold uppercase leading-[1.05] tracking-[0.01em] text-[var(--ink)] sm:text-[1rem] lg:text-[1.14rem]">
          {candidate.fullName}
        </h3>
        <div className="mt-1.5 max-w-[24.5rem] border-t border-dashed border-[var(--ink-line)]" />
        <div className="mt-2 grid gap-1 sm:mt-2.5 sm:gap-1.5">
          {matric ? (
            <p className="truncate font-mono text-[0.72rem] font-semibold uppercase tracking-[0.045em] text-[var(--teal)] sm:text-[0.86rem] lg:text-[0.9rem]">
              {matric}
            </p>
          ) : null}
          <p className="line-clamp-2 font-serif text-[0.78rem] font-medium leading-[1.12] text-[var(--ink)] sm:text-[0.92rem] lg:text-[0.98rem]">
            {positionName}
          </p>
        </div>
      </div>

      <RadioMark checked={isSelected} />
    </button>
  );
}

function TicketBorder({ selected }: { selected: boolean }) {
  const stroke = selected ? "var(--teal)" : "var(--ink-line)";
  const softStroke = selected
    ? "color-mix(in oklab, var(--teal) 42%, transparent)"
    : "color-mix(in oklab, var(--ink-line) 62%, transparent)";

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 160"
    >
      <path
        d={TICKET_FILL_PATH}
        fill={
          selected
            ? "color-mix(in oklab, var(--teal) 7%, var(--paper))"
            : "var(--paper)"
        }
      />
      <path
        d={TICKET_BORDER_PATH}
        fill="none"
        stroke={softStroke}
        strokeDasharray="1.2 2.4"
        strokeWidth="0.55"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={TICKET_BORDER_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? "0.95" : "0.68"}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M 8 33 H 92"
        fill="none"
        stroke="var(--ink-line)"
        strokeDasharray="1.2 2.4"
        strokeWidth="0.55"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const TICKET_FILL_PATH =
  "M 6 2 Q 8.5 4.2 11 2 Q 13.5 4.2 16 2 Q 18.5 4.2 21 2 Q 23.5 4.2 26 2 Q 28.5 4.2 31 2 Q 33.5 4.2 36 2 Q 38.5 4.2 41 2 Q 43.5 4.2 46 2 Q 48.5 4.2 51 2 Q 53.5 4.2 56 2 Q 58.5 4.2 61 2 Q 63.5 4.2 66 2 Q 68.5 4.2 71 2 Q 73.5 4.2 76 2 Q 78.5 4.2 81 2 Q 83.5 4.2 86 2 Q 88.5 4.2 91 2 L 98 2 Q 95.8 4.5 98 7 Q 95.8 9.5 98 12 Q 95.8 14.5 98 17 Q 95.8 19.5 98 22 Q 95.8 24.5 98 27 Q 95.8 29.5 98 32 Q 95.8 34.5 98 37 Q 95.8 39.5 98 42 Q 95.8 44.5 98 47 Q 95.8 49.5 98 52 Q 95.8 54.5 98 57 Q 95.8 59.5 98 62 Q 95.8 64.5 98 67 Q 95.8 69.5 98 72 Q 95.8 74.5 98 77 Q 95.8 79.5 98 82 Q 95.8 84.5 98 87 Q 95.8 89.5 98 92 Q 95.8 94.5 98 97 Q 95.8 99.5 98 102 Q 95.8 104.5 98 107 Q 95.8 109.5 98 112 Q 95.8 114.5 98 117 Q 95.8 119.5 98 122 Q 95.8 124.5 98 127 Q 95.8 129.5 98 132 Q 95.8 134.5 98 137 Q 95.8 139.5 98 142 Q 95.8 144.5 98 147 Q 95.8 149.5 98 152 L 98 158 Q 95.5 155.8 93 158 Q 90.5 155.8 88 158 Q 85.5 155.8 83 158 Q 80.5 155.8 78 158 Q 75.5 155.8 73 158 Q 70.5 155.8 68 158 Q 65.5 155.8 63 158 Q 60.5 155.8 58 158 Q 55.5 155.8 53 158 Q 50.5 155.8 48 158 Q 45.5 155.8 43 158 Q 40.5 155.8 38 158 Q 35.5 155.8 33 158 Q 30.5 155.8 28 158 Q 25.5 155.8 23 158 Q 20.5 155.8 18 158 Q 15.5 155.8 13 158 Q 10.5 155.8 8 158 L 2 158 Q 4.2 155.5 2 153 Q 4.2 150.5 2 148 Q 4.2 145.5 2 143 Q 4.2 140.5 2 138 Q 4.2 135.5 2 133 Q 4.2 130.5 2 128 Q 4.2 125.5 2 123 Q 4.2 120.5 2 118 Q 4.2 115.5 2 113 Q 4.2 110.5 2 108 Q 4.2 105.5 2 103 Q 4.2 100.5 2 98 Q 4.2 95.5 2 93 Q 4.2 90.5 2 88 Q 4.2 85.5 2 83 Q 4.2 80.5 2 78 Q 4.2 75.5 2 73 Q 4.2 70.5 2 68 Q 4.2 65.5 2 63 Q 4.2 60.5 2 58 Q 4.2 55.5 2 53 Q 4.2 50.5 2 48 Q 4.2 45.5 2 43 Q 4.2 40.5 2 38 Q 4.2 35.5 2 33 Q 4.2 30.5 2 28 Q 4.2 25.5 2 23 Q 4.2 20.5 2 18 Q 4.2 15.5 2 13 Q 4.2 10.5 2 8 L 2 2 Z";

const TICKET_BORDER_PATH = TICKET_FILL_PATH;

function SelectedStamp({ visible }: { visible: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-[0.65rem] top-2 z-30 hidden h-[4.5rem] w-[4.5rem] rotate-[-14deg] place-items-center rounded-full border border-dashed border-[var(--teal)]",
        "bg-[color-mix(in_oklab,var(--paper)_74%,transparent)] font-mono text-[0.56rem] font-semibold uppercase tracking-[0.06em] text-[var(--teal)] shadow-[0_4px_12px_rgba(15,106,106,0.13)] backdrop-blur-[1px]",
        "before:absolute before:inset-[5px] before:rounded-full before:border before:border-[var(--teal)]",
        "after:absolute after:inset-[11px] after:rounded-full after:border after:border-dashed after:border-[color-mix(in_oklab,var(--teal)_68%,transparent)]",
        "lg:right-[0.45rem] lg:top-[0.25rem] lg:h-[6.6rem] lg:w-[6.6rem] lg:text-[0.78rem]",
        "lg:before:inset-[7px] lg:after:inset-[17px]",
        visible ? "grid" : null,
      )}
    >
      <span className="relative z-10">Selected</span>
    </span>
  );
}

function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 grid h-7 w-7 place-items-center justify-self-center rounded-full border sm:h-8 sm:w-8 sm:justify-self-center lg:mt-auto lg:h-10 lg:w-10 lg:self-center",
        "transition-[border-color,box-shadow,background-color,color] duration-200",
        checked
          ? "hidden border-[var(--teal)] bg-[var(--teal)] text-[var(--paper)] shadow-[0_2px_8px_rgba(15,106,106,0.18)] sm:grid"
          : "border-[color-mix(in_oklab,var(--ink)_58%,var(--paper))] bg-[var(--paper)] text-transparent shadow-[inset_0_0_0_3px_var(--paper)]",
      )}
    >
      <Check
        className={cn(
          "h-3.5 w-3.5 stroke-[2.4] transition-[opacity,transform] duration-200 sm:h-4 sm:w-4 lg:h-5 lg:w-5",
          checked ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      />
    </span>
  );
}

function SelectionDock({
  chosen,
  confirming,
  submitting,
  onBack,
  onContinue,
  onSubmit,
}: {
  chosen: DemoCandidate | undefined;
  confirming: boolean;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="absolute inset-x-0 bottom-2 z-30 px-3 sm:bottom-3"
      role="region"
      aria-label="Cast your vote"
    >
      <div className="relative mx-auto grid min-h-[6.15rem] max-w-[46rem] grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 pl-3 pr-4 drop-shadow-[0_12px_28px_rgba(40,30,20,0.13)] sm:min-h-[6.4rem] sm:grid-cols-[2.35rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5 sm:py-3">
        <LandscapeTicketBorder active={Boolean(chosen)} />

        <div className="relative z-10 flex h-full items-center justify-center border-r border-dashed border-[var(--ink-line)] pr-2">
          <span className="[writing-mode:vertical-rl] rotate-180 font-mono text-[0.52rem] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            Detach here
          </span>
        </div>

        <div className="relative z-10 min-w-0">
          {chosen ? (
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="aspect-[3/4] h-[4.9rem] shrink-0 overflow-hidden rounded-[2px] border border-[var(--ink-line)] bg-[var(--paper-2)] shadow-[0_5px_12px_rgba(40,30,20,0.12)] sm:h-[5.2rem]">
                <CandidatePhoto
                  src={chosen.photoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                  iconClassName="mx-auto h-8 w-8"
                />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[0.5rem] font-semibold uppercase tracking-[0.18em] text-[var(--teal)] sm:text-[0.56rem]">
                  Selected candidate
                </p>
                <p className="truncate font-serif text-[0.88rem] font-semibold uppercase leading-tight text-[var(--ink)] sm:text-[1.02rem]">
                  {chosen.fullName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-serif text-[0.72rem] leading-tight text-[var(--ink-muted)] sm:text-[0.8rem]">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 stroke-[1.8] text-[var(--ink-muted)] sm:h-4 sm:w-4" aria-hidden />
                  This vote is final.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--ink-line)] text-[var(--ink-muted)]">
                <Check className="h-5 w-5" aria-hidden />
              </div>
              <p className="min-w-0 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
                Pick a candidate above to continue
              </p>
            </div>
          )}
        </div>

        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {confirming ? (
            <>
              <Button
                variant="outline"
                onClick={onBack}
                disabled={submitting}
                className="h-10 rounded-[3px] border-[var(--ink-line)] bg-[var(--paper)] px-3 font-serif text-sm sm:px-4"
              >
                Back
              </Button>
              <Button
                onClick={onSubmit}
                loading={submitting}
                className="h-10 rounded-[3px] bg-[var(--teal)] px-3 font-serif text-sm text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--teal)_88%,var(--ink))] sm:px-6"
              >
                Submit
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button
              disabled={!chosen}
              onClick={onContinue}
              className="h-10 rounded-[3px] bg-[var(--teal)] px-3 font-serif text-sm text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--teal)_88%,var(--ink))] sm:h-11 sm:px-7 sm:text-base"
            >
              Continue
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LandscapeTicketBorder({ active }: { active: boolean }) {
  const stroke = active ? "var(--teal)" : "var(--ink-line)";
  const softStroke = active
    ? "color-mix(in oklab, var(--teal) 36%, transparent)"
    : "color-mix(in oklab, var(--ink-line) 58%, transparent)";

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 220 70"
    >
      <path
        d={LANDSCAPE_TICKET_PATH}
        fill={
          active
            ? "color-mix(in oklab, var(--teal) 5%, var(--paper))"
            : "var(--paper)"
        }
      />
      <path
        d={LANDSCAPE_TICKET_PATH}
        fill="none"
        stroke={softStroke}
        strokeDasharray="1.4 2.8"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={LANDSCAPE_TICKET_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={active ? "0.9" : "0.65"}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const LANDSCAPE_TICKET_PATH =
  "M 5 2 Q 7.5 4.2 10 2 Q 12.5 4.2 15 2 Q 17.5 4.2 20 2 Q 22.5 4.2 25 2 Q 27.5 4.2 30 2 Q 32.5 4.2 35 2 Q 37.5 4.2 40 2 Q 42.5 4.2 45 2 Q 47.5 4.2 50 2 Q 52.5 4.2 55 2 Q 57.5 4.2 60 2 Q 62.5 4.2 65 2 Q 67.5 4.2 70 2 Q 72.5 4.2 75 2 Q 77.5 4.2 80 2 Q 82.5 4.2 85 2 Q 87.5 4.2 90 2 Q 92.5 4.2 95 2 Q 97.5 4.2 100 2 Q 102.5 4.2 105 2 Q 107.5 4.2 110 2 Q 112.5 4.2 115 2 Q 117.5 4.2 120 2 Q 122.5 4.2 125 2 Q 127.5 4.2 130 2 Q 132.5 4.2 135 2 Q 137.5 4.2 140 2 Q 142.5 4.2 145 2 Q 147.5 4.2 150 2 Q 152.5 4.2 155 2 Q 157.5 4.2 160 2 Q 162.5 4.2 165 2 Q 167.5 4.2 170 2 Q 172.5 4.2 175 2 Q 177.5 4.2 180 2 Q 182.5 4.2 185 2 Q 187.5 4.2 190 2 Q 192.5 4.2 195 2 Q 197.5 4.2 200 2 Q 202.5 4.2 205 2 Q 207.5 4.2 210 2 Q 212.5 4.2 215 2 L 218 2 Q 215.8 4.5 218 7 Q 215.8 9.5 218 12 Q 215.8 14.5 218 17 Q 215.8 19.5 218 22 Q 215.8 24.5 218 27 Q 215.8 29.5 218 32 Q 215.8 34.5 218 37 Q 215.8 39.5 218 42 Q 215.8 44.5 218 47 Q 215.8 49.5 218 52 Q 215.8 54.5 218 57 Q 215.8 59.5 218 62 L 218 68 Q 215.5 65.8 213 68 Q 210.5 65.8 208 68 Q 205.5 65.8 203 68 Q 200.5 65.8 198 68 Q 195.5 65.8 193 68 Q 190.5 65.8 188 68 Q 185.5 65.8 183 68 Q 180.5 65.8 178 68 Q 175.5 65.8 173 68 Q 170.5 65.8 168 68 Q 165.5 65.8 163 68 Q 160.5 65.8 158 68 Q 155.5 65.8 153 68 Q 150.5 65.8 148 68 Q 145.5 65.8 143 68 Q 140.5 65.8 138 68 Q 135.5 65.8 133 68 Q 130.5 65.8 128 68 Q 125.5 65.8 123 68 Q 120.5 65.8 118 68 Q 115.5 65.8 113 68 Q 110.5 65.8 108 68 Q 105.5 65.8 103 68 Q 100.5 65.8 98 68 Q 95.5 65.8 93 68 Q 90.5 65.8 88 68 Q 85.5 65.8 83 68 Q 80.5 65.8 78 68 Q 75.5 65.8 73 68 Q 70.5 65.8 68 68 Q 65.5 65.8 63 68 Q 60.5 65.8 58 68 Q 55.5 65.8 53 68 Q 50.5 65.8 48 68 Q 45.5 65.8 43 68 Q 40.5 65.8 38 68 Q 35.5 65.8 33 68 Q 30.5 65.8 28 68 Q 25.5 65.8 23 68 Q 20.5 65.8 18 68 Q 15.5 65.8 13 68 Q 10.5 65.8 8 68 L 2 68 Q 4.2 65.5 2 63 Q 4.2 60.5 2 58 Q 4.2 55.5 2 53 Q 4.2 50.5 2 48 Q 4.2 45.5 2 43 Q 4.2 40.5 2 38 Q 4.2 35.5 2 33 Q 4.2 30.5 2 28 Q 4.2 25.5 2 23 Q 4.2 20.5 2 18 Q 4.2 15.5 2 13 Q 4.2 10.5 2 8 L 2 2 Z";

function displayMatric(matric: string | null | undefined): string | null {
  if (!matric || matric.startsWith("auto-")) return null;
  return matric;
}

function portraitDataUrl(initial: string, accent: string, ground: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320">
      <rect width="240" height="320" fill="${ground}"/>
      <path d="M28 292c22-54 56-82 92-82s70 28 92 82" fill="${accent}" opacity="0.22"/>
      <circle cx="120" cy="116" r="54" fill="${accent}" opacity="0.18"/>
      <path d="M76 130c10-36 30-54 60-54 24 0 43 14 54 42-22-8-42-8-60 0-18 8-36 12-54 12Z" fill="${accent}" opacity="0.5"/>
      <circle cx="98" cy="126" r="5" fill="#0b0f12" opacity="0.58"/>
      <circle cx="142" cy="126" r="5" fill="#0b0f12" opacity="0.58"/>
      <path d="M96 158c16 11 32 11 48 0" fill="none" stroke="#0b0f12" stroke-width="6" stroke-linecap="round" opacity="0.45"/>
      <text x="120" y="260" text-anchor="middle" font-family="Azeret Mono, monospace" font-size="52" font-weight="600" fill="#0b0f12" opacity="0.35">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
