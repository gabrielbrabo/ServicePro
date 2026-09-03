import { api } from "../lib/api";

export interface LessonTopic {
  title: string;
  done: boolean;
  date: string;
}
export interface LessonPlan {
  _id: string;
  establishment: string;
  studentName: string;
  studentPhone: string;
  subject: string;
  goal: string;
  topics: LessonTopic[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type LessonPlanPayload = Partial<
  Omit<LessonPlan, "_id" | "establishment" | "createdAt" | "updatedAt">
>;

export const lessonPlanApi = {
  list: (establishmentId: string) =>
    api
      .get<LessonPlan[]>(`/lesson-plans/${establishmentId}`)
      .then((r) => r.data),

  create: (establishmentId: string, data: LessonPlanPayload) =>
    api
      .post<LessonPlan>(`/lesson-plans/${establishmentId}`, data)
      .then((r) => r.data),

  update: (establishmentId: string, id: string, data: LessonPlanPayload) =>
    api
      .put<LessonPlan>(`/lesson-plans/${establishmentId}/${id}`, data)
      .then((r) => r.data),

  remove: (establishmentId: string, id: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `/lesson-plans/${establishmentId}/${id}`
      )
      .then((r) => r.data),
};
