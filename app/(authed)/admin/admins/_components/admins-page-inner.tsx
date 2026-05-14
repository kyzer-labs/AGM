"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { AdminsBody } from "./admins-body";
import { AdminsPageSkeleton } from "./admins-skeleton";

export function AdminsPageInner() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const list = useQuery(api.admins.listAdmins);

  const isSuper = adminStatus?.role === "super";

  useEffect(() => {
    if (adminStatus === undefined) return;
    if (!isSuper) router.replace("/admin");
  }, [adminStatus, isSuper, router]);

  if (
    adminStatus === undefined ||
    list === undefined ||
    me === undefined
  ) {
    return <AdminsPageSkeleton />;
  }

  if (!isSuper || me === null) return null;

  return <AdminsBody actorEmail={me.email} list={list} />;
}
