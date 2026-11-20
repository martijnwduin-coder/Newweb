import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DealsView } from "@/components/deals-view";
import { PageHeader } from "@/components/shell";

const GROUPS: Record<string, { title: string; subtitle: string }> = {
  "air-force-1": { title: "Air Force 1", subtitle: "Every Air Force 1 colourway and edition, tracked per colourway and country." },
  "air-max": { title: "Air Max", subtitle: "Air Max 90, 1, 95, 97, Dn, Dn8, Plus/TN, SC, Excee and more." },
  running: { title: "Running", subtitle: "Pegasus, Vomero, Zoom Fly, Streakfly, Structure, Invincible and other running shoes." },
  basketball: { title: "Basketball", subtitle: "Air Jordan 1/3/4/11, Caitlin Clark, Sabrina, LeBron, Giannis, Ja and more." },
  training: { title: "Training", subtitle: "Metcon, Free Metcon, Romaleos and other training shoes." },
  other: { title: "Other Nike", subtitle: "Shox, Skylon, Dunk, Cortez, Blazer, P-6000, V2K, Killshot, Field General and other footwear." },
  apparel: { title: "Apparel & accessories", subtitle: "Jackets, hoodies, sweatshirts, T-shirts, tracksuits, sweatpants, shorts, sports bras, socks, bags, caps." },
};

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  return { title: GROUPS[group]?.title ?? "Category" };
}

export default async function GroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const g = GROUPS[group];
  if (!g) notFound();
  return (
    <>
      <PageHeader title={g.title} subtitle={g.subtitle} />
      <Suspense>
        <DealsView group={group} />
      </Suspense>
    </>
  );
}
