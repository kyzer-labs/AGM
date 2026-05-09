"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { GrainOverlay } from "@/components/landing/grain-overlay";
import { SignInCTA } from "@/components/landing/sign-in-cta";

const ShaderBg = dynamic(
  () => import("@/components/landing/shader-bg").then((m) => m.ShaderBg),
  { ssr: false },
);

export default function LandingPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <ShaderBg />
      <GrainOverlay />

      <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2">
        <div className="surface-glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2">
          <Image
            src="/logos/cs-soc-official.svg"
            alt=""
            width={22}
            height={22}
            priority
            className="h-[22px] w-[22px]"
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink)]">
            USM CSS AGM
          </span>
        </div>
      </div>

      <section className="container-narrow relative flex min-h-[100dvh] flex-col justify-center py-32">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          USM CSS · annual general meeting
        </span>
        <h1 className="font-display mt-6 text-[clamp(2.75rem,8vw,7rem)] leading-[0.95] tracking-[-0.04em] text-[var(--ink)]">
          Elect the next CSS committee.
        </h1>
        <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Sign in with your @student.usm.my Microsoft account to continue.
        </p>
        <div className="mt-10">
          <SignInCTA />
        </div>
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
      </footer>
    </main>
  );
}
