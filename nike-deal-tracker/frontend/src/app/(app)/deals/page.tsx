import { Suspense } from "react";
import { DealsView } from "@/components/deals-view";
import { PageHeader } from "@/components/shell";

export const metadata = { title: "Best Deals" };

export default function DealsPage() {
  return (
    <>
      <PageHeader title="Best Deals" subtitle="Every discounted Nike product found on Zalando NL, DE, FR, ES and PL. Prices exactly as observed at the last scan." />
      <Suspense>
        <DealsView />
      </Suspense>
    </>
  );
}
