import type { Metadata } from "next";
import { Admin } from "@/components/admin/admin";

export const metadata: Metadata = {
  title: "Админка",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <Admin />;
}
