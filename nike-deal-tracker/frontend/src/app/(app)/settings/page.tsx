import { PageHeader } from "@/components/shell";
import { SettingsView } from "./view";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Schedule, email, connectors, franchises and scan logs." />
      <SettingsView />
    </>
  );
}
