// Quick sanity script: npx tsx src/lib/ai/engine.check.ts
import { createDemoDatabase, DEMO_ME_ID } from "../demo/seed";
import { recommend, templateAnswer } from "./engine";

const db = createDemoDatabase();
for (const q of [
  "Find me a great Italian restaurant in Amsterdam recommended by my friends.",
  "Where should I get coffee near me?",
  "Find somewhere similar to the restaurants I rated highly.",
  "What are the best places my friends have saved in Copenhagen?",
  "Give me five great date-night restaurants.",
  "A hidden-gem bakery in Paris",
  "Cheap sushi in Lisbon",
]) {
  const { intent, candidates, relaxed } = recommend(db, DEMO_ME_ID, q, { location: q.includes("near me") ? { lat: 52.3702, lng: 4.8952 } : null });
  const top = candidates.slice(0, intent.count);
  console.log(`\nQ: ${q}\n  ${templateAnswer(intent, top)}${relaxed ? `\n  NOTE: ${relaxed}` : ""}`);
  for (const c of top) console.log(`  - ${c.place.name} (${c.place.city}) score=${c.score.toFixed(2)} | ${c.facts[0]}`);
}
