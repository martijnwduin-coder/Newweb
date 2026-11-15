"use client";
import { Check, UserCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFollowing, relationship } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";

export function UserActions({ userId, size = "sm", showFollow = true }: { userId: string; size?: "sm" | "default"; showFollow?: boolean }) {
  const { db, meId, actions } = useStore();
  const rel = relationship(db, meId, userId);
  const following = isFollowing(db, meId, userId);
  if (rel === "self") return null;
  const pending = db.friendships.find((f) => f.requesterId === userId && f.addresseeId === meId && f.status === "pending");

  return (
    <div className="flex items-center gap-2">
      {rel === "none" && (
        <Button size={size} onClick={() => actions.sendFriendRequest(userId)}>
          <UserPlus /> Add friend
        </Button>
      )}
      {rel === "pending_out" && (
        <Button size={size} variant="outline" onClick={() => actions.removeFriendship(userId)}>
          Requested
        </Button>
      )}
      {rel === "pending_in" && pending && (
        <>
          <Button size={size} onClick={() => actions.respondFriendRequest(pending.id, true)}>
            <Check /> Accept
          </Button>
          <Button size={size} variant="outline" onClick={() => actions.respondFriendRequest(pending.id, false)} aria-label="Decline">
            <X />
          </Button>
        </>
      )}
      {rel === "friends" && (
        <Button
          size={size}
          variant="soft"
          onClick={() => {
            if (confirm("Remove from friends?")) actions.removeFriendship(userId);
          }}
        >
          <UserCheck /> Friends
        </Button>
      )}
      {showFollow && rel !== "friends" && (
        <Button size={size} variant={following ? "soft" : "outline"} onClick={() => actions.toggleFollow(userId)}>
          {following ? "Following" : "Follow"}
        </Button>
      )}
    </div>
  );
}
