export type Franchise = { slug: string; name: string; group: string; priority: number };

export type Deal = {
  variant_id: number;
  product_id: number;
  sku: string | null;
  name: string;
  local_name: string;
  model: string | null;
  colourway: string | null;
  category: string;
  subcategory: string | null;
  gender: string;
  image_url: string | null;
  is_sample: boolean;
  franchise: Franchise | null;
  group: string;
  country: string;
  currency: string;
  url: string;
  listed: boolean;
  price: number;
  original_price: number | null;
  price_eur: number;
  original_price_eur: number | null;
  discount_pct: number;
  discount_amount_eur: number;
  band: string;
  band_label: string;
  flagged: boolean;
  in_stock: boolean;
  sizes: string[];
  observed_at: string;
  previous_price_eur: number | null;
  price_change_eur: number | null;
  discounted_since: string | null;
  first_seen_at: string | null;
  prior_low_price: number | null;
  prior_low_price_eur: number | null;
  discount_vs_prior_low_pct: number | null;
  reference_label: string | null;
  price_varies: boolean;
  shipping: { cost: number | null; currency: string | null; destination: string | null; days_min: number | null; days_max: number | null } | null;
  country_count?: number;
  cheapest_country?: string[];
  is_cheapest?: boolean | null;
  savings_vs_highest_eur?: number;
  score: number;
  watched?: boolean;
};

export type ScanBrief = {
  id: number;
  status: string;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  is_sample: boolean;
  products_found: number;
  new_discounts: number;
};

export type CountrySummary = {
  country: string;
  products: number;
  discounted: number;
  strong_deals: number;
  avg_discount: number;
  max_discount: number;
  cheapest_wins: number;
};

export type Overview = {
  sample_mode: boolean;
  operational: boolean;
  products_tracked: number;
  listings_tracked: number;
  discounted_products: number;
  discounts_30_plus: number;
  new_deals_this_week: number;
  biggest_discount: Deal | null;
  cheapest_product: Deal | null;
  last_scan: ScanBrief | null;
  last_successful_scan: ScanBrief | null;
  next_scheduled_scan: string | null;
  countries: CountrySummary[];
  top_deals: Deal[];
  watchlist_alerts: number;
  watchlist_matches: { rule_id: number; rule: string; deal: Deal }[];
  running_scan: ScanBrief | null;
};

export type Offer = {
  country: string;
  currency: string;
  price: number;
  original_price: number | null;
  price_eur: number;
  discount_pct: number;
  in_stock: boolean;
  url: string;
  sizes: string[];
  listed?: boolean;
  observed_at?: string;
};

export type Comparison = {
  product_id: number;
  sku: string | null;
  name: string;
  colourway: string | null;
  franchise?: Franchise | { slug: string; name: string } | null;
  image_url: string | null;
  is_sample: boolean;
  cheapest_country: string | null;
  highest_discount_country: string | null;
  lowest_price_eur: number | null;
  highest_price_eur: number | null;
  spread_eur: number | null;
  spread_pct: number | null;
  available_in: string[];
  discount_only_in_some?: boolean;
  price_differs?: boolean;
  offers: Offer[];
};

export type HistoryPoint = {
  t: string;
  price: number;
  currency: string;
  price_eur: number;
  original_price_eur: number | null;
  discount_pct: number;
  in_stock: boolean;
};

export type HistoryStats = {
  observations: number;
  span_days?: number;
  current_eur?: number;
  lowest_eur?: number;
  highest_eur?: number;
  average_eur?: number;
  first_observed?: string;
  last_observed?: string;
  all_time_low?: boolean | null;
  below_30d_avg?: boolean | null;
  avg_30d?: number | null;
  below_90d_avg?: boolean | null;
  avg_90d?: number | null;
  max_discount_pct?: number;
};

export type ProductDetail = Comparison & {
  model: string | null;
  category: string;
  subcategory: string | null;
  gender: string;
  first_seen_at: string;
  history_stats: Record<string, HistoryStats>;
  size_availability: Record<string, { size: string; in_stock: boolean }[]>;
};

export type FiltersMeta = {
  countries: { code: string; name: string; currency: string }[];
  franchises: (Franchise & { count: number })[];
  groups: { slug: string; name: string }[];
  categories: string[];
  genders: string[];
  sizes: string[];
};

export type Rule = {
  id: number;
  kind: "product" | "franchise" | "colourway";
  label: string | null;
  product_id: number | null;
  product_name: string | null;
  franchise_slug: string | null;
  franchise_name: string | null;
  colourway: string | null;
  size: string | null;
  country_code: string | null;
  min_discount: number | null;
  max_price_eur: number | null;
  active: boolean;
  tracked?: number;
  triggered?: number;
  description?: string;
};

export type ScanCountry = {
  country: string;
  connector: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  requests: number;
  products_found: number;
  products_updated: number;
  new_products: number;
  new_discounts: number;
  rejected: number;
  errors: string[];
};

export type Scan = ScanBrief & {
  products_updated: number;
  new_products: number;
  error: string | null;
  week_key: string | null;
  countries: ScanCountry[];
};
