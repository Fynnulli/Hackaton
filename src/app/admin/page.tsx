import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";

export const metadata: Metadata = {
  title: "Admin · 3-Stunden-Build",
};

export default function Page() {
  return <AdminPage />;
}
