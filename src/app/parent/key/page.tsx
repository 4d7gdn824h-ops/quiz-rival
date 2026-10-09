import Link from "next/link";
import { PACK_CATALOG, getCatalogItem } from "@/data/catalog";
import type { QuizVariant } from "@/data/types";
import { ParentKeyClient } from "@/components/ParentKeyClient";
import { loadAnswerKey } from "@/lib/homework/answer-key";

export default async function ParentKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string; variant?: string }>;
}) {
  const query = await searchParams;
  const variant = (query.variant === "B" ? "B" : "A") as QuizVariant;
  const requested = query.pack ?? "warmup-en";
  const builtIn = Boolean(getCatalogItem(requested));
  const initial = builtIn ? loadAnswerKey({ packId: requested, variant, parentKey: null }) : null;

  return (
    <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-300">
        Parent only
      </p>
      <h1 className="font-display text-4xl">Answer key</h1>
      <p className="text-white/70">
        English hints for a quiz this device created, or for a built-in demo. Other
        families&apos; worksheets are not listed here.
      </p>
      <nav className="flex flex-wrap gap-2">
        {PACK_CATALOG.map((item) => (
          <Link
            key={item.id}
            href={`/parent/key?pack=${item.id}&variant=${variant}`}
            className={`rounded-full px-3 py-2 text-sm ${
              item.id === initial?.id ? "bg-lime-300 text-black" : "bg-white/10"
            }`}
          >
            <span className="title-clamp" title={item.title}>
              {item.title}
            </span>
          </Link>
        ))}
        {(["A", "B"] as const).map((option) => (
          <Link
            key={option}
            href={`/parent/key?pack=${builtIn ? requested : "warmup-en"}&variant=${option}`}
            className={`rounded-full px-3 py-2 text-sm ${
              option === variant && builtIn ? "bg-white text-black" : "bg-white/10"
            }`}
          >
            Variant {option}
          </Link>
        ))}
      </nav>
      {initial ? (
        <p className="text-sm text-white/55">{initial.title}</p>
      ) : null}
      <ParentKeyClient initial={initial} variant={variant} />
      <Link className="inline-block text-white/60 underline underline-offset-4" href="/">
        Back to QuizRival
      </Link>
    </main>
  );
}
