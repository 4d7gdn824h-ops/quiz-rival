import { HomeClient } from "@/components/HomeClient";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const query = await searchParams;
  return <HomeClient initialPackId={query.pack} />;
}
