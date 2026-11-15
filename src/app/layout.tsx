import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { StoreProvider } from "@/lib/store/store";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Peloton AI — Good places. Better connections.", template: "%s · Peloton AI" },
  description: "Discover restaurants, cafés and coffee spots through people you trust — not algorithms.",
  applicationName: "Peloton AI",
  openGraph: { siteName: "Peloton AI", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#F7F5EF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <StoreProvider>{children}</StoreProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: "#242824", color: "#F7F5EF", border: "none", borderRadius: 999, fontSize: 14, padding: "10px 18px" },
          }}
        />
      </body>
    </html>
  );
}
