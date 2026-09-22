import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/actions/auth";

export default async function Home() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.status === "PENDING") redirect("/dashboard/pending");
  if (session.status === "SUSPENDED") redirect("/dashboard/suspended");
  redirect(session.role === "TEACHER" ? "/admin" : "/dashboard");
}
