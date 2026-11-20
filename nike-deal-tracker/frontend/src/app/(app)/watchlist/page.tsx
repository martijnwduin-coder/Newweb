import { PageHeader } from "@/components/shell";
import { WatchlistView } from "./view";

export const metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  return (
    <>
      <PageHeader title="Watchlist" subtitle="Follow products, franchises, colourways and sizes. Rules with a threshold become alerts in the dashboard and the Monday email." />
      <WatchlistView />
    </>
  );
}
