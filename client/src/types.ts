export type Priority = "high" | "medium" | "low";
export type Status = "pending" | "scratched";

export interface Task {
  id: number;
  title: string;
  date: string;
  status: Status;
  priority: Priority;
  color: string;
  created_at: string;
}

export interface Concept {
  term: string;
  def: string;
}

export interface TopicConnect {
  id: string;
  why: string;
}

export interface Topic {
  id: number;
  slug: string;
  name: string;
  abbr: string;
  icon: string;
  color: string;
  category: string;
  description: string;
  analogy?: string;
  concepts: Concept[];
  connects: TopicConnect[];
}

export interface JournalTheme {
  bg: string;
  font: string;
  textColor: string;
}

export interface Journal {
  id: number;
  name: string;
  content?: any;
  theme: JournalTheme;
  created_at: string;
  updated_at: string;
}

// ── Finance ──────────────────────────────────────────────────────────────────

export type FinanceTransactionType = "income" | "expense";
export type FinanceCategoryType = "expense" | "savings";

export interface FinanceCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
  monthly_budget: number;
  type: FinanceCategoryType;
  created_at: string;
}

export interface FinanceTransaction {
  id: number;
  amount: number;
  type: FinanceTransactionType;
  category_id: number | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  date: string;
  note: string;
  is_recurring: boolean;
  is_goal: boolean;
  recurring_id: number | null;
  created_at: string;
}

export interface FinanceRecurring {
  id: number;
  title: string;
  amount: number;
  category_id: number | null;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  type: FinanceTransactionType;
  day_of_month: number;
  active: boolean;
}

export interface FinanceGoal {
  id: number;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_at: string;
}

export interface FinanceMonthlySummary {
  month: string;
  opening_balance: number;
  closing_balance: number;
  total_income: number;
  total_expenses: number;
}

export interface FinanceCategorySpending extends FinanceCategory {
  spent: number;
}