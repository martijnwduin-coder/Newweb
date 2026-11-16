"use client";
import { useRouteParam } from "@/lib/use-route-param";
import { UserX } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/rail";
import { useStore } from "@/lib/store/store";

export default function UserPageClient() {
  const username = useRouteParam("username");
  const { db } = useStore();
  const p = db.profiles.find((x) => x.username === username);
  if (!p)
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState icon={UserX} title="No one here" body={`We couldn't find @${username}.`} action={<Button asChild><Link href="/friends">Find people</Link></Button>} />
      </div>
    );
  return (
    <Suspense>
      <ProfileView userId={p.id} />
    </Suspense>
  );
}
