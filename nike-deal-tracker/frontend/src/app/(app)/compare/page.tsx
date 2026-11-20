import { PageHeader } from "@/components/shell";
import { CompareView } from "./view";

export const metadata = { title: "Price Comparison" };

export default function ComparePage() {
  return (
    <>
      <PageHeader
        title="Price Comparison"
        subtitle="Identical products (same Zalando SKU) across the five countries, sorted by the biggest price difference. PLN is converted to EUR at the ECB reference rate."
      />
      <CompareView />
    </>
  );
}
