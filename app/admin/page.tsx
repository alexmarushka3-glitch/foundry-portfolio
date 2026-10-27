import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import LoginForm from "@/components/admin/LoginForm";
import { ADMIN_COOKIE, adminEnabled, sessionValid } from "@/lib/server/adminAuth";

export const dynamic = "force-dynamic";
// The login page is not for search engines.
export const metadata = { robots: { index: false, follow: false } };

/** The admin dashboard. It doesn't exist (404) unless ADMIN_TOKEN is set, and it needs the signed-in cookie. */
export default async function AdminPage() {
  if (!adminEnabled()) notFound();
  const jar = await cookies();
  if (!sessionValid(jar.get(ADMIN_COOKIE)?.value)) return <LoginForm />;
  return (
    <main>
      <AdminDashboard />
    </main>
  );
}
