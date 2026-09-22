import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/actions/auth";
import { homeRedirectPath } from "@/lib/auth/session-refresh";

export default async function Home() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  redirect(homeRedirectPath(session));
}
