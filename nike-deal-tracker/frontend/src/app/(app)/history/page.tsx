import { Suspense } from "react";
import { PageHeader } from "@/components/shell";
import { HistoryView } from "./view";

export const metadata = { title: "Price History" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Price History" subtitle="Pick a product to see its recorded prices per country, lowest/highest/average and how today compares." />
      <Suspense>
        <HistoryView />
      </Suspense>
    </>
  );
}
