import type { Metadata, Viewport } from "next";
import { Libre_Baskerville } from "next/font/google";
import { Toaster } from "sonner";
import { StoreProvider } from "@/lib/store/store";
import "./globals.css";

const serif = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Peloton AI — Good places. Better connections.", template: "%s · Peloton AI" },
  description: "Discover restaurants, cafés and coffee spots through people you trust — not algorithms.",
  applicationName: "Peloton AI",
  openGraph: { siteName: "Peloton AI", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#F8F8F7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable}>
      <body>
        <StoreProvider>{children}</StoreProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: "#1A1A19", color: "#FFFFFF", border: "none", borderRadius: 10, fontSize: 14, padding: "10px 18px" },
          }}
        />
      </body>
    </html>
  );
}
