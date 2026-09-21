import type { Metadata } from "next";
import { WriteCoach } from "@/components/WriteCoach";

export const metadata: Metadata = {
  title: "Napisz wypracowanie · QuizRival",
  description: "Krok po kroku: pytanie problemowe z Chłopów, ok. 100 słów.",
};

export default function WritePage() {
  return <WriteCoach />;
}
