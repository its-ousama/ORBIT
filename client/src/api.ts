import http from "./http";
import type { Task, Priority, Topic, Journal, JournalTheme } from "./types";

export const getTasks = (date: string) =>
  http.get<Task[]>("/tasks", { params: { date } }).then(r => r.data);

export const createTask = (data: { title: string; date: string; priority: Priority; color: string }) =>
  http.post<Task>("/tasks", data).then(r => r.data);

export const updateStatus = (id: number, status: string) =>
  http.patch<Task>(`/tasks/${id}/status`, { status }).then(r => r.data);

export const deleteTask = (id: number) =>
  http.delete(`/tasks/${id}`).then(r => r.data);

export const getTopics = () =>
  http.get<Topic[]>("/topics").then(r => r.data);

export const createTopic = (data: Omit<Topic, "id">) =>
  http.post<Topic>("/topics", data).then(r => r.data);

export const updateTopic = (id: number, data: Omit<Topic, "id">) =>
  http.put<Topic>(`/topics/${id}`, data).then(r => r.data);

export const deleteTopic = (id: number) =>
  http.delete(`/topics/${id}`).then(r => r.data);

// ── Journal ──────────────────────────────────────────────────────────────────

export const getJournalStatus = () =>
  http.get<{ configured: boolean }>("/journals/config/status").then(r => r.data);

export const setupJournal = (data: { password: string; answer: string; number: string }) =>
  http.post("/journals/config/setup", data).then(r => r.data);

export const verifyJournal = (data: { password: string; answer: string; number: string }) =>
  http.post<{ success: boolean }>("/journals/config/verify", data).then(r => r.data);

export const getJournals = () =>
  http.get<Journal[]>("/journals").then(r => r.data);

export const getJournal = (id: number) =>
  http.get<Journal>(`/journals/${id}`).then(r => r.data);

export const createJournal = (name: string) =>
  http.post<Journal>("/journals", { name }).then(r => r.data);

export const saveJournalContent = (id: number, content: any) =>
  http.put<Journal>(`/journals/${id}`, { content }).then(r => r.data);

export const updateJournalTheme = (id: number, theme: JournalTheme) =>
  http.patch<Journal>(`/journals/${id}/theme`, { theme }).then(r => r.data);

export const renameJournal = (id: number, name: string) =>
  http.patch<Journal>(`/journals/${id}`, { name }).then(r => r.data);

export const deleteJournal = (id: number) =>
  http.delete(`/journals/${id}`).then(r => r.data);
