"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Vote, ClipboardCheck, ShieldCheck, BarChart3 } from "lucide-react";

export default function DashboardPage() {
  const me = useQuery(api.voters.me);

  if (!me) {
    return null;
  }

  const isAdmin = me.role === "admin" || me.role === "super";

  return (
    <main className="container-wide py-10 space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {me.fullName ?? me.email.split("@")[0]}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Pick where you want to go. Your access is determined automatically
          from your USM email.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardTile
          href="/internal"
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="Internal evaluation"
          description="Year 2 whitelist members score every candidate against the rubric."
          tone="brand"
        />
        <DashboardTile
          href="/vote"
          icon={<Vote className="h-5 w-5" />}
          title="AGM live voting"
          description="Vote in the active position when the public session is open."
          tone="success"
        />
        <DashboardTile
          href="/results"
          icon={<BarChart3 className="h-5 w-5" />}
          title="Published results"
          description="See the winner and 75/25 breakdown for each position once results are published."
          tone="muted"
        />
        {isAdmin ? (
          <DashboardTile
            href="/admin"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Admin console"
            description="Configure the election, manage candidates, monitor voting, and publish results."
            tone="warning"
          />
        ) : null}
      </section>
    </main>
  );
}

function DashboardTile({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "brand" | "success" | "warning" | "muted";
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-[var(--color-foreground)]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-secondary)]">
              {icon}
            </div>
            <Badge tone={tone}>Open</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="mb-1.5">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardContent>
      </Card>
    </Link>
  );
}
