import { NextResponse } from "next/server";
import { z } from "zod";
import { Anthropic, isLLMConfigured, narrate } from "@/lib/ai/llm";

const Body = z.object({
  query: z.string().min(1).max(500),
  count: z.number().int().min(1).max(10).default(5),
  profile: z.record(z.string(), z.unknown()).default({}),
  candidates: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().max(200),
        category: z.string().max(40),
        cuisine: z.string().max(80).nullish(),
        city: z.string().max(80),
        neighborhood: z.string().max(80).nullish(),
        priceLevel: z.number().nullish(),
        pelotonRating: z.number().nullable(),
        pelotonReviewCount: z.number(),
        friendRecommenders: z.array(z.string().max(80)).max(30),
        facts: z.array(z.string().max(300)).max(20),
      }),
    )
    .max(20),
});

/**
 * POST /api/ai/discover
 * The client runs the deterministic engine and sends the top candidates (with their
 * verified facts). If an LLM is configured, it re-ranks and narrates them; otherwise
 * the client keeps the engine's template answer.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isLLMConfigured() || !body.candidates.length) return NextResponse.json({ mode: "engine" });

  try {
    const answer = await narrate(body);
    // Guardrail: drop anything that isn't a real candidate.
    const ids = new Set(body.candidates.map((c) => c.id));
    const picks = answer.picks.filter((p) => ids.has(p.id)).slice(0, body.count);
    return NextResponse.json({ mode: "llm", intro: answer.intro, picks });
  } catch (e) {
    // Degrade gracefully: the client already has the engine's grounded answer.
    const reason =
      e instanceof Anthropic.RateLimitError
        ? "The AI is busy right now"
        : e instanceof Anthropic.AuthenticationError
          ? "The AI key is invalid"
          : e instanceof Anthropic.APIError
            ? "The AI service had a problem"
            : "The AI couldn't answer";
    console.error("[ai/discover]", e);
    return NextResponse.json({ mode: "engine", error: `${reason} — showing Peloton's own ranking.` });
  }
}
