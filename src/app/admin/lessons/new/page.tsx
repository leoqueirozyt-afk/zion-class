import {
  LessonForm,
  type LessonFormValues,
} from "@/components/admin/lesson-form";
import { nextTuesdayISO } from "@/lib/utils/format";

const empty: LessonFormValues = {
  title: "",
  description: "",
  date: nextTuesdayISO(),
  videoUrl: "",
  thumbnailUrl: "",
  isPublished: false,
  materials: [],
  questions: [],
};

export default function NewLessonPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nova aula</h1>
      <LessonForm lessonId={null} initial={empty} />
    </div>
  );
}
