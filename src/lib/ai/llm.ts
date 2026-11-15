import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * LLM service layer. Swappable: anything that implements `narrate` can replace it.
 * The model only ever sees verified candidates and their facts, and must answer
 * with candidate IDs — which the caller validates.
 */
export const isLLMConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = process.env.PELOTON_AI_MODEL || "claude-opus-5-5";

export interface CandidateInput {
  id: string;
  name: string;
  category: string;
  cuisine?: string | null;
  city: string;
  neighborhood?: string | null;
  priceLevel?: number | null;
  pelotonRating: number | null;
  pelotonReviewCount: number;
  friendRecommenders: string[];
  facts: string[];
}

const Answer = z.object({
  intro: z.string().describe("One or two warm sentences answering the user. No ratings or names that are not in the facts."),
  picks: z
    .array(
      z.object({
        id: z.string().describe("Must be one of the candidate ids exactly"),
        why: z.string().describe("One sentence grounded only in that candidate's facts"),
      }),
    )
    .describe("Best matches in order, at most the requested count"),
});

export type Narration = z.infer<typeof Answer>;

const SYSTEM = `You are Peloton, a warm, concise restaurant and coffee guide inside a social discovery app.
Philosophy: discover places through people, not algorithms. Prefer places recommended by the user's friends.

Hard rules:
- Recommend ONLY places from the provided candidates, referenced by their exact id.
- Use ONLY the facts given. Never invent ratings, reviews, dishes, people, opening hours or prices.
- "Peloton community rating" comes from app members. Do not call it a Google rating or vice versa.
- If no candidate fits, return an empty picks array and say so kindly.
- Write like a knowledgeable friend: specific, brief, no hype words, no emojis.`;

let client: Anthropic | null = null;

export async function narrate(input: {
  query: string;
  count: number;
  profile: Record<string, unknown>;
  candidates: CandidateInput[];
}): Promise<Narration> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Chat-style, latency-sensitive route: low effort is plenty for ranking + one-liners.
    output_config: { effort: "low", format: betaZodOutputFormat(Answer) },
    // Server-side fallback if the primary model declines a request.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          request: input.query,
          wanted: input.count,
          user_taste_profile: input.profile,
          candidates: input.candidates,
        }),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The assistant couldn't help with that request.");
  if (!response.parsed_output) throw new Error("The assistant returned an unexpected response.");
  return response.parsed_output;
}

export { Anthropic };
