import type { Metadata } from "next";
import { WriteCoach } from "@/components/WriteCoach";

export const metadata: Metadata = {
  title: "Napisz wypracowanie · QuizRival",
  description: "Krok po kroku: pytanie z karty lub z Chłopów, ok. 100 słów.",
};

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const query = await searchParams;
  return <WriteCoach packId={query.pack} />;
}
