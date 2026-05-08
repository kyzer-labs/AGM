"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoElection } from "@/components/admin/no-election";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";

const TIER_LABELS: Record<number, string> = {
  1: "President",
  2: "Vice Presidents",
  3: "Directors",
  4: "Other",
};

const DEFAULT_TIER_FOR_NAME = (name: string): number => {
  const n = name.toLowerCase();
  if (n.includes("president") && !n.includes("vice")) return 1;
  if (n.includes("vice president") || n.startsWith("vp")) return 2;
  if (n.includes("director")) return 3;
  return 4;
};

const addSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tier: z.coerce.number().int().min(1).max(9),
});
type AddForm = z.infer<typeof addSchema>;

const DEFAULT_POSITIONS = [
  "President",
  "Vice President of Internal Affairs",
  "Vice President of External Affairs",
  "Director of Secretarial Department",
  "Director of Financial Department",
  "Director of Creative Department",
  "Director of Growth Marketing Department",
  "Director of Community Engagement Department",
  "Director of Technical Department",
];

export default function PositionsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }
  if (election === null) return <NoElection />;
  return <PositionsBody election={election} />;
}

function PositionsBody({ election }: { election: Doc<"elections"> }) {
  const positions = useQuery(api.positions.list, { electionId: election._id });
  const add = useMutation(api.positions.add);
  const move = useMutation(api.positions.move);
  const remove = useMutation(api.positions.remove);
  const updateName = useMutation(api.positions.updateName);

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { name: "", tier: 1 },
  });

  const lockedToSetup = election.phase !== "setup";

  const onAdd = form.handleSubmit(async (values) => {
    try {
      await add({
        electionId: election._id,
        name: values.name,
        tier: values.tier,
      });
      toast.success("Position added");
      form.reset({ name: "", tier: values.tier });
    } catch (err) {
      const m = getConvexErrorMessage(err, "Add failed.");
      toast.error("Add failed", { description: m });
    }
  });

  const onSeedDefaults = async () => {
    if (
      !window.confirm(
        "Add the 9 default positions (President, 2 VPs, 6 Directors)? Duplicates will be inserted if names already exist.",
      )
    ) {
      return;
    }
    try {
      for (const name of DEFAULT_POSITIONS) {
        await add({
          electionId: election._id,
          name,
          tier: DEFAULT_TIER_FOR_NAME(name),
        });
      }
      toast.success("Default positions added");
    } catch (err) {
      const m = getConvexErrorMessage(err, "Seed failed.");
      toast.error("Seed failed", { description: m });
    }
  };

  if (positions === undefined) {
    return (
      <main className="container-wide py-10 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const grouped = positions.reduce<Record<number, typeof positions>>(
    (acc, p) => {
      const tier = p.tier;
      const arr = acc[tier] ?? [];
      arr.push(p);
      acc[tier] = arr;
      return acc;
    },
    {},
  );
  const tierKeys = Object.keys(grouped)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Positions" }]} />

      <header className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Hierarchy and ballot order for{" "}
            <strong>{election.name}</strong>. Higher tier numbers vote later
            on AGM day; within a tier, the order column controls the exact
            ballot order.
          </p>
        </div>
        {lockedToSetup ? (
          <Badge tone="warning">Locked — election not in Setup</Badge>
        ) : null}
      </header>

      {!lockedToSetup ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a position</CardTitle>
            <CardDescription>
              Tier 1 = President, 2 = Vice Presidents, 3 = Directors. Use
              higher tiers for any extra roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={onAdd}
              className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="pos-name">Name</Label>
                <Input
                  id="pos-name"
                  placeholder="Director of Technical Department"
                  {...form.register("name")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pos-tier">Tier</Label>
                <Select id="pos-tier" {...form.register("tier")}>
                  {[1, 2, 3, 4].map((t) => (
                    <option key={t} value={t}>
                      {t} · {TIER_LABELS[t] ?? `Tier ${t}`}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" loading={form.formState.isSubmitting}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </form>
            {positions.length === 0 ? (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={onSeedDefaults}>
                  <ListOrdered className="h-4 w-4" /> Seed default 9 positions
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {positions.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="h-5 w-5" aria-hidden />}
          title="No positions yet"
          description="Use the form above or seed the 9 defaults to get started."
        />
      ) : (
        <div className="space-y-6">
          {tierKeys.map((tier) => {
            const tierPositions = grouped[tier] ?? [];
            return (
              <div key={tier} className="space-y-2">
                <h2 className="text-sm font-semibold tracking-wide text-[var(--color-muted-foreground)]">
                  Tier {tier}
                  {TIER_LABELS[tier] ? ` · ${TIER_LABELS[tier]}` : ""}
                </h2>
                <Card>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {tierPositions.map((p, idx) => (
                        <PositionRow
                          key={p._id}
                          position={p}
                          isFirst={idx === 0}
                          isLast={idx === tierPositions.length - 1}
                          locked={lockedToSetup}
                          onRemove={() => {
                            if (
                              !window.confirm(
                                `Delete position "${p.name}"? This also unassigns it from any candidates.`,
                              )
                            )
                              return;
                            void remove({ positionId: p._id }).then(
                              () => toast.success("Position deleted"),
                              (err: unknown) => {
                                toast.error("Delete failed", {
                                  description: getConvexErrorMessage(
                                    err,
                                    "Delete failed.",
                                  ),
                                });
                              },
                            );
                          }}
                          onMove={(direction) =>
                            void move({ positionId: p._id, direction }).then(
                              undefined,
                              (err: unknown) => {
                                toast.error("Reorder failed", {
                                  description: getConvexErrorMessage(
                                    err,
                                    "Reorder failed.",
                                  ),
                                });
                              },
                            )
                          }
                          onRename={(newName) =>
                            void updateName({
                              positionId: p._id,
                              name: newName,
                            }).then(
                              () => toast.success("Renamed"),
                              (err: unknown) => {
                                toast.error("Rename failed", {
                                  description: getConvexErrorMessage(
                                    err,
                                    "Rename failed.",
                                  ),
                                });
                              },
                            )
                          }
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function PositionRow({
  position,
  isFirst,
  isLast,
  locked,
  onRemove,
  onMove,
  onRename,
}: {
  position: Doc<"positions">;
  isFirst: boolean;
  isLast: boolean;
  locked: boolean;
  onRemove: () => void;
  onMove: (d: "up" | "down") => void;
  onRename: (n: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(position.name);

  return (
    <li className="flex items-center gap-3 p-3">
      <span className="grid h-7 w-9 place-items-center rounded-md bg-[var(--color-secondary)] text-xs font-medium tabular-nums">
        {position.order + 1}
      </span>
      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              onRename(draft);
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setDraft(position.name);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <span className="flex-1 text-sm">{position.name}</span>
      )}
      {!locked ? (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={isFirst}
            onClick={() => onMove("up")}
            aria-label="Move up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={isLast}
            onClick={() => onMove("down")}
            aria-label="Move down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          {!editing ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
            >
              Rename
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            onClick={onRemove}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}
