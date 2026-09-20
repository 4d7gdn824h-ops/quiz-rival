import Link from "next/link";
import { PACK_CATALOG } from "@/data/catalog";
import { getPack } from "@/data/quizzes";
import type { QuizVariant } from "@/data/types";

export default async function ParentKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string; variant?: string }>;
}) {
  const query = await searchParams;
  const packId = query.pack ?? "chlopi";
  const variant = (query.variant === "B" ? "B" : "A") as QuizVariant;
  const pack = getPack(packId) ?? getPack("chlopi");
  if (!pack) {
    return <p className="p-6">Pack not found.</p>;
  }
  const questions = pack.variants[variant];

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
        Parent only
      </p>
      <h1 className="font-display text-4xl">Answer key</h1>
      <p className="text-white/70">
        English hints for supervising a Polish quiz. This page is not linked from
        student play screens.
      </p>
      <nav className="flex flex-wrap gap-2">
        {PACK_CATALOG.map((item) => (
          <Link
            key={item.id}
            href={`/parent/key?pack=${item.id}&variant=${variant}`}
            className={`rounded-full px-3 py-2 text-sm ${
              item.id === pack.id ? "bg-lime-300 text-black" : "bg-white/10"
            }`}
          >
            {item.title}
          </Link>
        ))}
        {(["A", "B"] as const).map((option) => (
          <Link
            key={option}
            href={`/parent/key?pack=${pack.id}&variant=${option}`}
            className={`rounded-full px-3 py-2 text-sm ${
              option === variant ? "bg-white text-black" : "bg-white/10"
            }`}
          >
            Variant {option}
          </Link>
        ))}
      </nav>
      <ol className="space-y-4">
        {questions.map((question, index) => {
          const correct = question.options.find((o) => o.id === question.correctOptionId);
          return (
            <li key={question.id} className="card space-y-2">
              <p className="text-xs uppercase tracking-wide text-white/50">
                {index + 1}. {question.prompt}
              </p>
              <p className="font-semibold">
                Key: {question.correctOptionId}
                {correct ? ` — ${correct.text}` : ""}
              </p>
              <p className="text-sm text-lime-200">{question.parentHint}</p>
            </li>
          );
        })}
      </ol>
      <Link className="inline-block text-white/60 underline underline-offset-4" href="/">
        Back to QuizRival
      </Link>
    </main>
  );
}
