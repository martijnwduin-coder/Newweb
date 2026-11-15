"use client";
import { Bell, Check, Library, Send, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/rail";
import { placeById, profileById } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { AppNotification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export default function NotificationsPage() {
  const { db, meId, actions } = useStore();
  const items = db.notifications.filter((n) => n.userId === meId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const unreadIds = items.filter((n) => !n.isRead).map((n) => n.id);

  // Mark as read shortly after viewing, so unread styling is visible first.
  useEffect(() => {
    if (!unreadIds.length) return;
    const t = setTimeout(() => actions.markAllNotificationsRead(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.join()]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <h1 className="display text-[36px] text-ink">Notifications</h1>
      <div className="mt-8 space-y-2">
        {items.length ? items.map((n) => <Row key={n.id} n={n} />) : <EmptyState icon={Bell} title="All caught up" body="Friend requests and recommendations will show up here." />}
      </div>
    </div>
  );
}

function Row({ n }: { n: AppNotification }) {
  const { db, actions } = useStore();
  const actor = profileById(db, n.actorId);
  if (!actor) return null;
  const first = actor.fullName.split(" ")[0];
  let text: React.ReactNode = null;
  let href = `/u/${actor.username}`;
  let Icon = Bell;
  let extra: React.ReactNode = null;

  if (n.type === "friend_request") {
    Icon = UserPlus;
    const f = db.friendships.find((x) => x.id === n.referenceId);
    text = <><b>{actor.fullName}</b> sent you a friend request</>;
    if (f?.status === "pending")
      extra = (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => actions.respondFriendRequest(f.id, true)}>
            <Check /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.respondFriendRequest(f.id, false)}>
            <X /> Decline
          </Button>
        </div>
      );
    else if (f) extra = <p className="mt-1 text-[12.5px] text-muted">{f.status === "accepted" ? "You're now friends" : "Declined"}</p>;
  } else if (n.type === "friend_accepted") {
    Icon = Check;
    text = <><b>{first}</b> accepted your friend request</>;
  } else if (n.type === "new_follower") {
    Icon = UserPlus;
    text = <><b>{first}</b> started following you</>;
  } else if (n.type === "recommendation") {
    Icon = Send;
    const r = db.recommendations.find((x) => x.id === n.referenceId);
    const place = r?.placeId ? placeById(db, r.placeId) : null;
    const col = r?.collectionId ? db.collections.find((c) => c.id === r.collectionId) : null;
    if (place) href = `/place/${place.id}`;
    else if (col) href = `/collections/${col.id}`;
    text = <><b>{first}</b> sent you <b>{place?.name ?? col?.title ?? "a place"}</b></>;
    if (r?.message) extra = <p className="mt-1 text-[13.5px] text-charcoal/80">“{r.message}”</p>;
  } else if (n.type === "collection_follow") {
    Icon = Library;
    const col = db.collections.find((c) => c.id === n.referenceId);
    if (col) href = `/collections/${col.id}`;
    text = <><b>{first}</b> followed your collection <b>{col?.title}</b></>;
  }

  return (
    <div className={cn("flex gap-3 rounded-2xl p-4 transition", n.isRead ? "bg-white/50" : "bg-white shadow-soft")}>
      <Link href={`/u/${actor.username}`} className="relative shrink-0">
        <Avatar user={actor} />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper ring-2 ring-white">
          <Icon className="h-3 w-3" />
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block text-[14.5px] leading-snug [&_b]:font-semibold">
          {text}
        </Link>
        {extra}
        <p className="mt-1 text-[12px] text-muted">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </div>
  );
}
