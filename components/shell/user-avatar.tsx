"use client";

import Image from "next/image";
import { useState } from "react";

type UserAvatarProps = { fullName: string; avatarUrl: string | null };

function initialsForName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || "NU";
}

function safeAvatarUrl(avatarUrl: string | null) {
  if (!avatarUrl) return null;
  try {
    const url = new URL(avatarUrl);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password ? avatarUrl : null;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export function UserAvatar({ fullName, avatarUrl }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const safeUrl = safeAvatarUrl(avatarUrl);

  return (
    <span aria-hidden="true" className="user-avatar">
      {safeUrl && !imageFailed ? (
        <Image
          alt=""
          className="user-avatar-image"
          fill
          onError={() => setImageFailed(true)}
          sizes="32px"
          src={safeUrl}
          unoptimized
        />
      ) : initialsForName(fullName)}
    </span>
  );
}
