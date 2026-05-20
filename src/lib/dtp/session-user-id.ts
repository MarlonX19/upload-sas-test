import type { Session } from "next-auth";

/** Identificador estável do utilizador para jobs DTP. */
export function getSessionUserId(session: Session): string {
  const email = session.user?.email?.trim();
  if (email) return email.toLowerCase();
  const id = session.user?.id?.trim();
  if (id) return id;
  const name = session.user?.name?.trim();
  if (name) return name;
  return "unknown-user";
}
