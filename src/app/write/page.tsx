import type { Metadata } from "next";
import { WriteCoach } from "@/components/WriteCoach";

export const metadata: Metadata = {
  title: "Writing coach · QuizRival",
  description: "Step-by-step writing help for any prompt and language. The coach does not write the essay.",
};

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string; preset?: string }>;
}) {
  const query = await searchParams;
  return <WriteCoach initialPackId={query.pack} initialPreset={query.preset} />;
}
