import { HomeworkClient } from "@/components/HomeworkClient";
import { PracticeBanner } from "@/components/PracticeBanner";

export const metadata = {
  title: "Scan homework · QuizRival",
  description: "Upload a worksheet, confirm notes, generate tonight’s rivalry pack.",
};

export default function HomeworkPage() {
  return (
    <>
      <PracticeBanner />
      <HomeworkClient />
    </>
  );
}
