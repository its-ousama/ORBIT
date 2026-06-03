import http from "./http";

export interface Book {
  id: number;
  title: string;
  author: string;
  file_size: number;
  source: "epub" | "gutenberg";
  gutenberg_id: string | null;
  has_cover: boolean;
  current_location: string | null;
  percent_complete: number;
  last_read_at: string | null;
  finished_at: string | null;
  added_at: string;
}

export interface BookHistoryEntry {
  id: number;
  book_id: number | null;
  title: string;
  author: string;
  source: "epub" | "gutenberg";
  finished_at: string;
}

export interface GutenbergBook {
  id: number;
  title: string;
  authors: Array<{ name: string }>;
  formats: Record<string, string>;
}

export const getBooks = () =>
  http.get<Book[]>("/books").then(r => r.data);

export const uploadEpub = (file: File) => {
  const form = new FormData();
  form.append("epub", file);
  return http.post<Book>("/books/upload", form).then(r => r.data);
};

export const deleteBook = (id: number) =>
  http.delete(`/books/${id}`).then(r => r.data);

export const updateProgress = (id: number, current_location: string, percent_complete: number) =>
  http.put(`/books/${id}/progress`, { current_location, percent_complete }).then(r => r.data);

export const getHistory = () =>
  http.get<BookHistoryEntry[]>("/books/history").then(r => r.data);

export const searchGutenberg = (q: string) =>
  http.get<{ count: number; results: GutenbergBook[] }>("/books/gutenberg/search", { params: { q } }).then(r => r.data);

export const downloadFromGutenberg = (gutenbergId: number) =>
  http.get<Book>(`/books/gutenberg/${gutenbergId}/download`).then(r => r.data);
