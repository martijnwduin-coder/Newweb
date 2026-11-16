import { rateLimit, tooMany } from "@/lib/rate-limit";
import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Fetch the cover image server-side so a slow/blocked image host never breaks the card. */
async function loadImage(src: string | null) {
  if (!src || !/^https:\/\//.test(src)) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 4_000_000) return null;
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function Chair({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M10 16.5V10a6 6 0 0 1 12 0v6.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13.5 9.5v6M18.5 9.5v6" stroke={color} strokeWidth="1.44" strokeLinecap="round" opacity="0.6" />
      <path d="M7.5 17.5h17" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M10 18.5 9 27M22 18.5l1 8.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "share-card", 60);
  if (!limited.ok) return tooMany(limited.retryAfter);
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "Peloton AI").slice(0, 80);
  const subtitle = (searchParams.get("subtitle") ?? "").slice(0, 120);
  const rating = searchParams.get("rating");
  const label = (searchParams.get("label") ?? "Peloton community").slice(0, 40);
  const format = searchParams.get("format") === "square" ? "square" : searchParams.get("format") === "og" ? "og" : "story";
  const size = format === "story" ? { width: 1080, height: 1920 } : format === "og" ? { width: 1200, height: 630 } : { width: 1080, height: 1080 };
  const image = await loadImage(searchParams.get("image"));
  const big = format === "story";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#F8F8F7", padding: big ? 64 : 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: big ? 88 : 64, height: big ? 88 : 64, borderRadius: 24, background: "#1A1A19", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Chair size={big ? 56 : 40} color="#F8F8F7" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: big ? 40 : 30, letterSpacing: 8, color: "#1A1A19", fontWeight: 700 }}>
            PELOTON <span style={{ fontSize: big ? 24 : 18, color: "#F5A524", letterSpacing: 3 }}>AI</span>
          </div>
        </div>
        <div
          style={{
            marginTop: big ? 56 : 32,
            flex: 1,
            display: "flex",
            borderRadius: 48,
            overflow: "hidden",
            background: "linear-gradient(135deg, #E5E5E2 0%, #F0F0EE 55%, #F5A524 100%)",
            position: "relative",
          }}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: big ? 56 : 28 }}>
          <div style={{ fontSize: big ? 92 : format === "og" ? 56 : 68, fontWeight: 400, color: "#1A1A1A", letterSpacing: -2, lineHeight: 1.02 }}>{title}</div>
          {subtitle ? <div style={{ marginTop: 16, fontSize: big ? 40 : 28, color: "#737373" }}>{subtitle}</div> : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: big ? 48 : 24 }}>
            {rating ? (
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#1A1A19", color: "#F8F8F7", borderRadius: 999, padding: big ? "18px 32px" : "12px 24px", fontSize: big ? 40 : 28 }}>
                <svg width={big ? 34 : 24} height={big ? 34 : 24} viewBox="0 0 24 24"><path fill="#F5A524" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.4l6.6-.8z" /></svg> {rating} <span style={{ opacity: 0.7, fontSize: big ? 28 : 20 }}>{label}</span>
              </div>
            ) : (
              <div style={{ display: "flex" }} />
            )}
            <div style={{ fontSize: big ? 30 : 22, color: "#1A1A19", opacity: 0.75 }}>Good places. Better connections.</div>
          </div>
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
