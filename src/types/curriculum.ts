export type CurriculumSubjectStatus = "ready" | "coming_soon";

export type CurriculumAvailabilitySlot = Readonly<{
  classLevel: string;
  subject: string;
}>;

export type CurriculumAvailabilityResponse = Readonly<{
  slots: readonly CurriculumAvailabilitySlot[];
}>;

export type CurriculumSubject = Readonly<{
  id: string;
  label: string;
  status: CurriculumSubjectStatus;
}>;

export type CurriculumClass = Readonly<{
  id: string;
  label: string;
  subjects: readonly CurriculumSubject[];
}>;

export type CurriculumSelection = Readonly<{
  classId: string;
  classLabel: string;
  subjectId: string;
  subjectLabel: string;
}>;
