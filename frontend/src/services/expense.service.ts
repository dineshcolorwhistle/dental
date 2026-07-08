import api from './api';

export interface ExpenseCategory {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  branchId: string | null;
  categoryId: string;
  title: string;
  description: string | null;
  amount: number;
  date: string;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  category: ExpenseCategory;
  branch?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateExpensePayload {
  title: string;
  description?: string;
  amount: number;
  date: string;
  paymentMethod: string;
  categoryId: string;
  branchId?: string;
}

export interface CreateExpenseCategoryPayload {
  name: string;
  description?: string;
}

export const expenseService = {
  // Categories
  getCategories: async (): Promise<ExpenseCategory[]> => {
    const response = await api.get<ExpenseCategory[]>('/expenses/categories');
    return response.data;
  },

  createCategory: async (payload: CreateExpenseCategoryPayload): Promise<ExpenseCategory> => {
    const response = await api.post<ExpenseCategory>('/expenses/categories', payload);
    return response.data;
  },

  updateCategory: async (id: string, payload: CreateExpenseCategoryPayload): Promise<ExpenseCategory> => {
    const response = await api.patch<ExpenseCategory>(`/expenses/categories/${id}`, payload);
    return response.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/expenses/categories/${id}`);
  },

  // Expenses
  getAllExpenses: async (filters?: {
    branchId?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<Expense[]> => {
    const params = {
      ...(filters?.branchId && filters.branchId !== 'ALL' && { branchId: filters.branchId }),
      ...(filters?.categoryId && filters.categoryId !== 'ALL' && { categoryId: filters.categoryId }),
      ...(filters?.startDate && { startDate: filters.startDate }),
      ...(filters?.endDate && { endDate: filters.endDate }),
      ...(filters?.search && { search: filters.search }),
    };
    const response = await api.get<Expense[]>('/expenses', { params });
    return response.data;
  },

  createExpense: async (payload: CreateExpensePayload): Promise<Expense> => {
    const response = await api.post<Expense>('/expenses', payload);
    return response.data;
  },

  updateExpense: async (id: string, payload: CreateExpensePayload): Promise<Expense> => {
    const response = await api.patch<Expense>(`/expenses/${id}`, payload);
    return response.data;
  },

  deleteExpense: async (id: string): Promise<void> => {
    await api.delete(`/expenses/${id}`);
  },
};
