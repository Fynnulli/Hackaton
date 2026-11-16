import type { Metadata } from "next";
import { SubmitPage } from "@/components/submit/submit-page";

export const metadata: Metadata = {
  title: "Abgabe · 3-Stunden-Build",
};

export default function Page() {
  return <SubmitPage />;
}
