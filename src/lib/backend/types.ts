import type {
  Collection,
  CollectionFollow,
  CollectionPlace,
  Database,
  Follow,
  Friendship,
  Place,
  PlaceRecommendation,
  Profile,
  Review,
  SavedPlace,
} from "../types";

/**
 * The persistence port. The client store applies every change optimistically to its
 * in-memory Database, then calls the backend. Demo mode persists to localStorage;
 * live mode writes to Supabase (RLS enforces ownership server-side).
 */
export interface Backend {
  mode: "demo" | "live";
  load(): Promise<{ db: Database; meId: string | null }>;
  upsertPlace(place: Place): Promise<Place>;
  upsertReview(review: Review): Promise<void>;
  deleteReview(id: string): Promise<void>;
  uploadPhoto(file: File, meId: string): Promise<string>;
  setSaved(row: SavedPlace, saved: boolean): Promise<void>;
  upsertCollection(c: Collection): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  setCollectionPlaces(collectionId: string, rows: CollectionPlace[]): Promise<void>;
  setCollectionFollow(row: CollectionFollow, following: boolean): Promise<void>;
  upsertFriendship(f: Friendship): Promise<void>;
  deleteFriendship(id: string): Promise<void>;
  setFollow(row: Follow, following: boolean): Promise<void>;
  sendRecommendation(r: PlaceRecommendation): Promise<void>;
  markNotificationsRead(ids: string[]): Promise<void>;
  updateProfile(p: Profile): Promise<void>;
  persist?(db: Database): void;
  /** Live updates for the signed-in user. Returns an unsubscribe function. */
  subscribe?(meId: string, onChange: (kind: "notification" | "friendship" | "recommendation") => void): () => void;
  signOut?(): Promise<void>;
}
