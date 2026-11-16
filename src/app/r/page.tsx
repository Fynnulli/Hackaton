import type { Metadata } from "next";
import { Reentry } from "@/components/reentry";

export const metadata: Metadata = {
  title: "Wiedereinstieg · 3-Stunden-Build",
  referrer: "no-referrer",
};

export default function Page() {
  return <Reentry />;
}
