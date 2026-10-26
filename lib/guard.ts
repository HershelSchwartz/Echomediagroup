import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "./auth";

/** For layouts: the signed-in user, or a redirect to sign in that returns to this page. */
export async function userOrLogin(fallback: string) {
  const user = await getUser();
  if (!user || !user.name) {
    const path = (await headers()).get("x-path") || fallback;
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user;
}
