import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { session as sessionTable, user as userTable } from "@/lib/db/schema/auth";

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  isActive: boolean;
  bannedAt: Date | null;
}

export interface ServerSession {
  token: string;
  user: ServerSessionUser;
}

async function getSessionFromPaayoCookie(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("paayo_session")?.value?.trim();
  if (!rawToken) return null;

  const rows = await db
    .select({
      token: sessionTable.token,
      userId: userTable.id,
      userEmail: userTable.email,
      userName: userTable.name,
      userImage: userTable.image,
      userRole: userTable.role,
      userIsActive: userTable.isActive,
      userBannedAt: userTable.bannedAt,
    })
    .from(sessionTable)
    .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(
      and(eq(sessionTable.token, rawToken), gt(sessionTable.expiresAt, new Date())),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    token: row.token,
    user: {
      id: row.userId,
      email: row.userEmail,
      name: row.userName,
      image: row.userImage,
      role: row.userRole,
      isActive: row.userIsActive,
      bannedAt: row.userBannedAt ?? null,
    },
  };
}

async function getSessionFromBetterAuth(): Promise<ServerSession | null> {
  try {
    const { auth } = await import("@/lib/auth-server");
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.session?.token || !session.user) return null;

    const user = session.user as Record<string, unknown>;
    const email = user.email;
    if (typeof email !== "string" || !email) return null;

    return {
      token: session.session.token,
      user: {
        id: typeof user.id === "string" ? user.id : "",
        email,
        name: typeof user.name === "string" ? user.name : null,
        image: typeof user.image === "string" ? user.image : null,
        role: typeof user.role === "string" ? user.role : "editor",
        isActive: Boolean(user.isActive),
        bannedAt: user.bannedAt instanceof Date ? user.bannedAt : null,
      },
    };
  } catch {
    return null;
  }
}

export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const sessionFromCookie = await getSessionFromPaayoCookie();
  if (sessionFromCookie) return sessionFromCookie;
  return getSessionFromBetterAuth();
});
