"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Vote, ShieldCheck, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignInButton } from "@/components/auth/sign-in-button";
import { useFirebaseAuth } from "@/lib/use-firebase-auth";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const firebase = useFirebaseAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <main className="gradient-brand min-h-dvh">
      <header className="container-wide flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
            <Vote className="h-4 w-4" aria-hidden />
          </span>
          <span>USM CSS AGM</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="#how"
            className="hidden text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] sm:inline-block"
          >
            How it works
          </Link>
          <Link
            href="#support"
            className="hidden text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] sm:inline-block"
          >
            Support
          </Link>
        </div>
      </header>

      <section className="container-narrow py-16 sm:py-24 text-center">
        <Badge tone="muted" className="mb-5">
          <Sparkles className="h-3 w-3" aria-hidden /> Official AGM portal
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
          Elect the next USM Computer Science Society committee.
        </h1>
        <p className="mt-5 text-lg text-[var(--color-muted-foreground)] text-balance">
          Sign in with your <strong>@student.usm.my</strong> Microsoft account
          to evaluate candidates internally, vote in the live AGM, and view
          published results.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {firebase.isLoading ? (
            <Button disabled loading size="lg">
              Loading
            </Button>
          ) : isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="lg">Go to dashboard</Button>
            </Link>
          ) : (
            <SignInButton size="lg" />
          )}
          <Link href="#how">
            <Button variant="outline" size="lg">
              Learn more
            </Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
          Only @student.usm.my accounts may sign in. Other Microsoft accounts
          will be rejected automatically.
        </p>
      </section>

      <section id="how" className="container-wide pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-secondary)]">
                <ShieldCheck
                  className="h-5 w-5 text-[var(--color-brand)]"
                  aria-hidden
                />
              </div>
              <h2 className="text-lg font-semibold">Internal evaluation</h2>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Year 2 committee members on the whitelist score every
                candidate using a 5-category rubric (Leadership, Teamwork &
                Communication, Professionalism & Ethics, Commitment,
                Personality) before AGM day.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-secondary)]">
                <Vote
                  className="h-5 w-5 text-[var(--color-brand)]"
                  aria-hidden
                />
              </div>
              <h2 className="text-lg font-semibold">Live AGM voting</h2>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                During the AGM, eligible USM students vote one position at a
                time. Candidates that already won a higher position are
                automatically removed from later ballots.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-secondary)]">
                <BarChart3
                  className="h-5 w-5 text-[var(--color-brand)]"
                  aria-hidden
                />
              </div>
              <h2 className="text-lg font-semibold">75 / 25 results</h2>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Final scores combine internal evaluation (75%) and the public
                AGM vote (25%) using normalized shares — turnout differences
                between the two pools never distort the split.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer
        id="support"
        className="border-t bg-[var(--color-background)]"
      >
        <div className="container-wide flex flex-col gap-2 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            For sign-in or eligibility questions, contact the AGM admin team.
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            USM Computer Science Society · AGM Election Portal
          </p>
        </div>
      </footer>
    </main>
  );
}
