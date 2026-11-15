/**
 * Peloton recommendation engine.
 *
 * Deterministic and grounded: every candidate and every "reason" is derived from
 * real rows in the Database (reviews, saves, follows, places). The LLM layer only
 * re-ranks and narrates these facts — it never sees, and cannot invent, anything else.
 */
import { friendIds, isSaved, placeStats, profileById, tasteProfile, trustedIds, visibleReviews } from "../selectors";
import type { Category, Database, Place, ReviewTag } from "../types";
import { CATEGORY_META, distanceKm } from "../utils";

export interface ParsedIntent {
  categories: Category[];
  cuisines: string[];
  city: string | null;
  neighborhood: string | null;
  tags: ReviewTag[];
  friendsOnly: boolean;
  /** "places my friends have saved" — requires a friend's save, not just a review. */
  friendsSaved: boolean;
  savedOnly: boolean;
  similarToMine: boolean;
  nearMe: boolean;
  maxPrice: number | null;
  minPrice: number | null;
  count: number;
  terms: string[];
}

export interface Candidate {
  place: Place;
  score: number;
  facts: string[];
  pelotonRating: number | null;
  pelotonReviewCount: number;
  friendRecommenders: string[];
  distanceKm: number | null;
}

const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10 };

const CATEGORY_WORDS: [RegExp, Category[]][] = [
  [/\b(coffee|espresso|flat white|latte|cappuccino|pour.?over|filter)\b/, ["coffee", "cafe"]],
  [/\b(caf[eé]s?|brunch|breakfast)\b/, ["cafe", "coffee"]],
  [/\b(bakery|bakeries|bread|croissants?|pastry|pastries|buns?|sourdough)\b/, ["bakery"]],
  [/\b(bars?|cocktails?|drinks|wine|natural wine|nightcap|aperitivo|spritz)\b/, ["bar"]],
  [/\b(restaurants?|dinner|lunch|eat|food|meal|omakase|tasting menu)\b/, ["restaurant"]],
];

const CUISINES: [RegExp, string][] = [
  [/\bitalian|pasta|pizza|trattoria|osteria\b/, "italian"],
  [/\bjapanese|sushi|omakase|ramen\b/, "japanese"],
  [/\bfrench|bistro|bistrot\b/, "french"],
  [/\bportuguese|sardines?\b/, "portuguese"],
  [/\bspanish|tapas|basque\b/, "spanish"],
  [/\bindonesian|rijsttafel\b/, "indonesian"],
  [/\bseafood|fish|oysters?\b/, "seafood"],
  [/\bdutch\b/, "dutch"],
  [/\bdanish|nordic\b/, "danish"],
];

const TAG_WORDS: [RegExp, ReviewTag][] = [
  [/date.?night|romantic|anniversary|\bdate\b/, "date night"],
  [/hidden gems?|secret|under the radar|off the beaten/, "hidden gem"],
  [/business lunch|work lunch|client/, "business lunch"],
  [/brunch/, "brunch"],
  [/groups?|big table|birthday|friends dinner/, "groups"],
  [/late.?night|after midnight|nightcap/, "late night"],
  [/outdoor|terrace|sunny|outside/, "outdoor seating"],
  [/laptop|work from|wifi/, "laptop friendly"],
  [/natural wine|orange wine|skin.?contact/, "natural wine"],
  [/casual/, "casual dinner"],
  [/solo|alone|by myself/, "solo friendly"],
  [/great coffee|best coffee|specialty coffee/, "great coffee"],
];

export function parseIntent(query: string, db: Database): ParsedIntent {
  const q = query.toLowerCase();
  const categories = [...new Set(CATEGORY_WORDS.filter(([re]) => re.test(q)).flatMap(([, c]) => c))];
  const cuisines = CUISINES.filter(([re]) => re.test(q)).map(([, c]) => c);
  // A cuisine implies a restaurant unless the user asked for something else.
  if (cuisines.length && !categories.length) categories.push("restaurant");
  const cities = [...new Set(db.places.map((p) => p.city))];
  const city = cities.find((c) => q.includes(c.toLowerCase())) ?? null;
  const neighborhoods = [...new Set(db.places.map((p) => p.neighborhood).filter(Boolean) as string[])];
  const neighborhood = neighborhoods.find((n) => q.includes(n.toLowerCase())) ?? null;
  const countMatch = q.match(/\b(\d{1,2})\b/) ?? q.match(new RegExp(`\\b(${Object.keys(NUMBERS).join("|")})\\b`));
  const count = countMatch ? Math.min(10, Math.max(1, Number(countMatch[1]) || NUMBERS[countMatch[1]] || 5)) : 5;
  return {
    categories,
    cuisines,
    city,
    neighborhood,
    tags: TAG_WORDS.filter(([re]) => re.test(q)).map(([, t]) => t),
    friendsOnly: /(my )?friends?('s|')? (have |has )?(saved|recommend|like|love|rated)|recommended by (my )?friends|friends recommend/.test(q),
    friendsSaved: /friends?('s|')? (have |has )?saved|saved by (my )?friends/.test(q),
    savedOnly: /\b(i|i've|ive|i have) saved|my saved|on my list|best places my friends have saved/.test(q) && !/friends have saved/.test(q),
    similarToMine: /similar|like the (ones|places|restaurants)|rated highly|i (loved|liked)|my favou?rites?/.test(q),
    nearMe: /near me|nearby|close by|around me|walking distance/.test(q),
    maxPrice: /cheap|budget|affordable|inexpensive|value/.test(q) ? 2 : null,
    minPrice: /fancy|special occasion|splurge|fine dining|high.?end/.test(q) ? 3 : null,
    count,
    terms: q.split(/\W+/).filter((w) => w.length > 3),
  };
}

export function recommend(
  db: Database,
  meId: string,
  query: string,
  opts: { location?: { lat: number; lng: number } | null } = {},
): { intent: ParsedIntent; candidates: Candidate[]; relaxed?: string } {
  const intent = parseIntent(query, db);
  if (intent.friendsSaved) {
    const strict = rank(db, meId, intent, opts, true);
    if (strict.length) return { intent, candidates: strict };
    return {
      intent,
      candidates: rank(db, meId, intent, opts, false),
      relaxed: `None of your friends have saved places${intent.city ? ` in ${intent.city}` : ""} yet, so these are places they rated highly instead.`,
    };
  }
  return { intent, candidates: rank(db, meId, intent, opts, false) };
}

function rank(
  db: Database,
  meId: string,
  intent: ParsedIntent,
  opts: { location?: { lat: number; lng: number } | null },
  requireFriendSave: boolean,
): Candidate[] {
  const trusted = trustedIds(db, meId);
  const friends = new Set(friendIds(db, meId));
  const reviews = visibleReviews(db, meId);
  const mine = reviews.filter((r) => r.userId === meId);
  const loved = mine.filter((r) => r.overall >= 4.5).map((r) => db.places.find((p) => p.id === r.placeId)).filter(Boolean) as Place[];
  const friendsSavedIn = (p: Place) =>
    db.saved
      .filter((s) => s.placeId === p.id && friends.has(s.userId))
      .map((s) => profileById(db, s.userId))
      .filter((u) => u && (u.privacy.saved !== "private"));

  const out: Candidate[] = [];
  for (const p of db.places) {
    if (intent.city && p.city !== intent.city) continue;
    if (intent.neighborhood && p.neighborhood !== intent.neighborhood) continue;
    if (intent.categories.length && !intent.categories.includes(p.category)) continue;
    const cuisineHay = `${p.cuisine ?? ""} ${p.name} ${p.description ?? ""}`.toLowerCase();
    if (intent.cuisines.length && !intent.cuisines.some((c) => cuisineHay.includes(c))) continue;
    if (intent.maxPrice && (p.priceLevel ?? 2) > intent.maxPrice) continue;
    if (intent.minPrice && (p.priceLevel ?? 2) < intent.minPrice) continue;
    if (intent.savedOnly && !isSaved(db, meId, p.id)) continue;

    const s = placeStats(db, p.id, meId);
    const facts: string[] = [];
    let score = 0;

    const trustedReviews = reviews.filter((r) => r.placeId === p.id && trusted.has(r.userId));
    for (const r of trustedReviews.sort((a, b) => b.overall - a.overall)) {
      const who = profileById(db, r.userId)!;
      score += (r.overall - 3) * (friends.has(r.userId) ? 1.4 : 1);
      facts.push(`${who.fullName.split(" ")[0]} (${friends.has(r.userId) ? "friend" : "you follow"}) rated it ${r.overall.toFixed(1)}★${r.recommendedItems[0] ? ` and recommends the ${r.recommendedItems[0]}` : ""}`);
    }
    const savers = friendsSavedIn(p);
    if (savers.length) {
      score += (requireFriendSave ? 1.2 : 0.6) * savers.length;
      const fact = `Saved by ${savers.map((u) => u!.fullName.split(" ")[0]).join(", ")}`;
      if (requireFriendSave) facts.unshift(fact);
      else facts.push(fact);
    }
    if (requireFriendSave && !savers.length) continue;
    if (intent.friendsOnly && !trustedReviews.some((r) => r.overall >= 4) && !savers.length) continue;

    if (s.count) {
      score += (s.rating! - 3.5) * 0.8 + Math.min(1, s.count / 6);
      facts.push(`Peloton community rating ${s.rating!.toFixed(1)}★ from ${s.count} ${s.count === 1 ? "review" : "reviews"}`);
    }

    for (const tag of intent.tags) {
      const n = s.topTags.find((t) => t.tag === tag)?.count ?? 0;
      if (n) {
        score += 1 + 0.4 * n;
        facts.push(`Tagged “${tag}” by ${n} ${n === 1 ? "reviewer" : "reviewers"}`);
      } else score -= 0.8;
    }

    if (intent.similarToMine || !intent.categories.length) {
      const twin = loved.find((l) => l.id !== p.id && (l.category === p.category || (l.cuisine && l.cuisine === p.cuisine)));
      if (twin) {
        score += intent.similarToMine ? 1.6 : 0.4;
        facts.push(`Similar to ${twin.name}, which you rated highly`);
      }
    }

    const my = mine.find((r) => r.placeId === p.id);
    if (my) {
      score -= intent.similarToMine ? 3 : 0.8;
      facts.push(`You've been — you rated it ${my.overall.toFixed(1)}★`);
    } else if (isSaved(db, meId, p.id)) {
      score += 0.4;
      facts.push("On your saved list");
    }

    let d: number | null = null;
    if (opts.location) {
      d = distanceKm(opts.location, p);
      if (intent.nearMe) {
        if (d > 15) continue;
        score += Math.max(0, 2 - d / 1.5);
      }
      if (d < 15) facts.push(`${d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`} from you`);
    }

    const text = `${p.name} ${p.cuisine} ${p.neighborhood} ${p.description} ${s.topItems.map((i) => i.item).join(" ")}`.toLowerCase();
    const termHits = intent.terms.filter((t) => text.includes(t)).length;
    score += termHits * 0.15;

    if (!facts.length) facts.push(`${CATEGORY_META[p.category].label} in ${p.neighborhood ?? p.city} with no Peloton reviews yet`);

    out.push({
      place: p,
      score,
      facts,
      pelotonRating: s.rating,
      pelotonReviewCount: s.count,
      friendRecommenders: s.recommenders.map((u) => u.fullName.split(" ")[0]),
      distanceKm: d,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Plain-language answer built only from the facts above (used when no LLM is configured). */
export function templateAnswer(intent: ParsedIntent, picks: Candidate[]) {
  if (!picks.length) {
    return `I couldn't find Peloton places matching that${intent.city ? ` in ${intent.city}` : ""}. Try widening the search — or explore the map to add new places.`;
  }
  const n = picks.length;
  const one = n === 1;
  const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
  const what = intent.cuisines.length
    ? `${intent.cuisines.map(cap).join(" & ")} ${one ? "spot" : "spots"}`
    : intent.categories.length
      ? [...new Set(intent.categories.map((c) => (c === "coffee" ? (one ? "coffee spot" : "coffee spots") : (one ? CATEGORY_META[c].label : CATEGORY_META[c].plural).toLowerCase())))].slice(0, 2).join(one ? " or " : " and ")
      : one ? "place" : "places";
  const where = intent.neighborhood ?? intent.city;
  const friendLed = picks.filter((p) => p.friendRecommenders.length).length;
  const social =
    friendLed === 0
      ? "None have friend reviews yet, so they're ranked by Peloton community ratings."
      : friendLed === n
        ? one ? "It comes recommended by people you trust." : `${n === 2 ? "Both" : "All of them"} come recommended by people you trust.`
        : `${friendLed} of them come${friendLed === 1 ? "s" : ""} recommended by people you trust.`;
  return `${one ? "Here's one" : `Here are ${n}`} ${what}${where ? ` in ${where}` : ""}${intent.tags.length ? ` for ${intent.tags.join(" & ")}` : ""}. ${social}`;
}

export function profileSummary(db: Database, meId: string) {
  const t = tasteProfile(db, meId);
  return {
    tasteTitle: t.title,
    traits: t.traits,
    favouriteCategories: t.topCategories.slice(0, 3).map((c) => c.category),
    favouriteTags: t.topTags.map((x) => x.tag),
    averageRatingGiven: t.averageGiven,
    pricePreference: t.pricePreference,
  };
}
