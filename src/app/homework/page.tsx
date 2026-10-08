import { HomeworkClient } from "@/components/HomeworkClient";
import { PracticeBanner } from "@/components/PracticeBanner";

export const metadata = {
  title: "Scan homework · QuizRival",
  description: "Upload worksheet pages and start the quiz.",
};

export default function HomeworkPage() {
  return (
    <>
      <PracticeBanner />
      <HomeworkClient />
    </>
  );
}
