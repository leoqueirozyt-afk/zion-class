import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentSession } from "@/lib/actions/auth";
import { getShowcase } from "@/lib/queries/showcase";
import { Showcase } from "@/components/dashboard/showcase";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const lessons = await getShowcase(getDb(), session.sub);
  return <Showcase lessons={lessons} />;
}
