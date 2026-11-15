"use client";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { useStore } from "@/lib/store/store";

export default function MyProfilePage() {
  const { meId } = useStore();
  return (
    <Suspense>
      <ProfileView userId={meId} />
    </Suspense>
  );
}
