// Core domain types for Peloton AI.
// These mirror the Postgres schema in supabase/migrations (snake_case there, camelCase here).

export type Category = "restaurant" | "coffee" | "cafe" | "bakery" | "bar";

export type Visibility = "public" | "friends" | "private";

export type PlaceSource = "demo" | "google" | "user";

export interface Place {
  id: string;
  googlePlaceId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood?: string | null;
  lat: number;
  lng: number;
  category: Category;
  cuisine?: string | null;
  imageUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  openingHours?: string[] | null;
  priceLevel?: number | null; // 1–4
  description?: string | null;
  createdAt: string;
  source: PlaceSource;
  /** External rating from Google Places. NEVER a Peloton community rating. */
  googleRating?: number | null;
  googleRatingCount?: number | null;
}

export interface PrivacySettings {
  profile: Visibility;
  saved: Visibility;
  reviews: Visibility;
}

export interface Profile {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  createdAt: string;
  privacy: PrivacySettings;
}

export type ReviewTag =
  | "date night"
  | "casual dinner"
  | "great coffee"
  | "brunch"
  | "business lunch"
  | "hidden gem"
  | "solo friendly"
  | "groups"
  | "outdoor seating"
  | "laptop friendly"
  | "natural wine"
  | "late night";

export const REVIEW_TAGS: ReviewTag[] = [
  "date night",
  "casual dinner",
  "great coffee",
  "brunch",
  "business lunch",
  "hidden gem",
  "solo friendly",
  "groups",
  "outdoor seating",
  "laptop friendly",
  "natural wine",
  "late night",
];

export interface Review {
  id: string;
  userId: string;
  placeId: string;
  overall: number; // 1–5, half steps allowed
  food?: number | null;
  drinks?: number | null;
  atmosphere?: number | null;
  service?: number | null;
  value?: number | null;
  text: string;
  photos: string[];
  visitedOn?: string | null;
  priceLevel?: number | null;
  recommendedItems: string[];
  tags: ReviewTag[];
  createdAt: string;
  updatedAt: string;
}

export type FriendshipStatus = "pending" | "accepted" | "declined";

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  coverImage?: string | null;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionPlace {
  id: string;
  collectionId: string;
  placeId: string;
  position: number;
}

export interface CollectionFollow {
  id: string;
  userId: string;
  collectionId: string;
  createdAt: string;
}

export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  createdAt: string;
}

export interface PlaceRecommendation {
  id: string;
  senderId: string;
  receiverId: string;
  placeId?: string | null;
  collectionId?: string | null;
  message: string;
  createdAt: string;
}

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "new_follower"
  | "recommendation"
  | "collection_follow";

export interface AppNotification {
  id: string;
  userId: string;
  actorId: string;
  type: NotificationType;
  referenceId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Database {
  profiles: Profile[];
  places: Place[];
  reviews: Review[];
  friendships: Friendship[];
  follows: Follow[];
  collections: Collection[];
  collectionPlaces: CollectionPlace[];
  collectionFollows: CollectionFollow[];
  saved: SavedPlace[];
  recommendations: PlaceRecommendation[];
  notifications: AppNotification[];
}

export type ReviewInput = Omit<Review, "id" | "userId" | "placeId" | "createdAt" | "updatedAt"> & {
  id?: string;
};
