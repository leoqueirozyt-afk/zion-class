export type MaterialRow = {
  title: string;
  url: string;
  type: "PDF" | "LINK" | "IMAGE" | "DOCUMENT";
  file?: File | null;
  mode?: "link" | "file";
};
export type QuestionRow = {
  questionText: string;
  questionType: "TEXT" | "MULTIPLE_CHOICE";
  options: string[];
  correctOptionIndex: number | null;
};
export type LessonFormValues = {
  title: string;
  description: string;
  date: string;
  videoUrl: string;
  thumbnailUrl: string;
  isPublished: boolean;
  materials: MaterialRow[];
  questions: QuestionRow[];
};

export function buildLessonFormData(
  v: LessonFormValues,
  publish?: boolean
): FormData {
  const fd = new FormData();
  fd.set("title", v.title);
  fd.set("description", v.description);
  fd.set("date", v.date);
  fd.set("videoUrl", v.videoUrl);
  fd.set("thumbnailUrl", v.thumbnailUrl);
  fd.set("isPublished", String(publish ?? v.isPublished));
  let fileIdx = 0;
  const materials = v.materials.map((m) => {
    if (m.file) {
      const i = fileIdx++;
      fd.set(`file_${i}`, m.file);
      return { title: m.title, url: "", type: "PDF" as const, _file: i };
    }
    return { title: m.title, url: m.url, type: m.type };
  });
  fd.set("materialsJson", JSON.stringify(materials));
  fd.set(
    "questionsJson",
    JSON.stringify(
      v.questions.map((q) => ({
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
      }))
    )
  );
  return fd;
}
