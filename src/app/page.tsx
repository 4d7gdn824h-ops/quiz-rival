import { HomeClient } from "@/components/HomeClient";
import { PracticeBanner } from "@/components/PracticeBanner";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <PracticeBanner />
      <HomeClient initialPackId={query.pack} />
    </>
  );
}
