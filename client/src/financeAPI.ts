import http from "./http";
import type {
  FinanceCategory, FinanceTransaction, FinanceRecurring,
  FinanceGoal, FinanceMonthlySummary, FinanceCategorySpending
} from "./types";

// Config / PIN
export const getFinanceStatus = () =>
  http.get<{ configured: boolean }>("/finance/config/status").then(r => r.data);

export const setupFinancePin = (pin: string) =>
  http.post("/finance/config/setup", { pin }).then(r => r.data);

export const verifyFinancePin = (pin: string) =>
  http.post<{ success: boolean }>("/finance/config/verify", { pin }).then(r => r.data);

// Categories
export const getCategories = () =>
  http.get<FinanceCategory[]>("/finance/categories").then(r => r.data);

export const createCategory = (data: Omit<FinanceCategory, "id" | "created_at">) =>
  http.post<FinanceCategory>("/finance/categories", data).then(r => r.data);

export const updateCategory = (id: number, data: Omit<FinanceCategory, "id" | "created_at">) =>
  http.put<FinanceCategory>(`/finance/categories/${id}`, data).then(r => r.data);

export const deleteCategory = (id: number) =>
  http.delete(`/finance/categories/${id}`).then(r => r.data);

// Transactions
export const getTransactions = (month?: string, category_id?: number) =>
  http.get<FinanceTransaction[]>("/finance/transactions", { params: { month, category_id } }).then(r => r.data);

export const createTransaction = (data: {
  amount: number;
  type: string;
  category_id?: number | null;
  date: string;
  note?: string;
  is_recurring?: boolean;
  recurring_id?: number | null;
  is_goal?: boolean;
}) => http.post<FinanceTransaction>("/finance/transactions", data).then(r => r.data);

export const updateTransaction = (id: number, data: any) =>
  http.put<FinanceTransaction>(`/finance/transactions/${id}`, data).then(r => r.data);

export const deleteTransaction = (id: number) =>
  http.delete(`/finance/transactions/${id}`).then(r => r.data);

// Recurring
export const getRecurring = () =>
  http.get<FinanceRecurring[]>("/finance/recurring").then(r => r.data);

export const getPendingRecurring = (month: string) =>
  http.get<FinanceRecurring[]>(`/finance/recurring/pending/${month}`).then(r => r.data);

export const createRecurring = (data: any) =>
  http.post<FinanceRecurring>("/finance/recurring", data).then(r => r.data);

export const skipRecurring = (recurring_id: number, month: string) =>
  http.post("/finance/recurring/skip", { recurring_id, month }).then(r => r.data);

export const deleteRecurring = (id: number) =>
  http.delete(`/finance/recurring/${id}`).then(r => r.data);

// Goals
export const getGoals = () =>
  http.get<FinanceGoal[]>("/finance/goals").then(r => r.data);

export const createGoal = (data: any) =>
  http.post<FinanceGoal>("/finance/goals", data).then(r => r.data);

export const contributeToGoal = (id: number, amount: number) =>
  http.patch<FinanceGoal>(`/finance/goals/${id}/contribute`, { amount }).then(r => r.data);

export const updateGoal = (id: number, data: any) =>
  http.put<FinanceGoal>(`/finance/goals/${id}`, data).then(r => r.data);

export const deleteGoal = (id: number) =>
  http.delete(`/finance/goals/${id}`).then(r => r.data);

// Summary & spending
export const getMonthlySummary = (month: string) =>
  http.get<FinanceMonthlySummary>(`/finance/summary/${month}`).then(r => r.data);

export const getCategorySpending = (month: string) =>
  http.get<FinanceCategorySpending[]>(`/finance/spending/${month}`).then(r => r.data);
