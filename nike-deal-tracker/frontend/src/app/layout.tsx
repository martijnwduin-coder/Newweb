import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nike Deal Tracker", template: "%s · Nike Deal Tracker" },
  description: "Nike discounts across Zalando NL, DE, FR, ES and PL",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#08080a", width: "device-width", initialScale: 1 };

const themeScript = `try{var t=localStorage.getItem('ndt-theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
