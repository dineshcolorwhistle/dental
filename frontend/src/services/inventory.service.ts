import api from './api';

export interface InventoryCategory {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: string;
  productType: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  sku: string;
  categoryId: string;
  status: string;
  currentQuantity: number;
  minQuantity: number;
  unitPrice: number;
  brand: string | null;
  supplier: string | null;
  expiryDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  category: InventoryCategory;
  branch?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateInventoryPayload {
  name: string;
  sku: string;
  categoryId: string;
  status: string;
  currentQuantity: number;
  minQuantity: number;
  unitPrice: number;
  brand?: string;
  supplier?: string;
  expiryDate?: string;
  description?: string;
  branchId?: string;
}

export interface UpdateInventoryPayload {
  name?: string;
  sku?: string;
  categoryId?: string;
  status?: string;
  currentQuantity?: number;
  minQuantity?: number;
  unitPrice?: number;
  brand?: string;
  supplier?: string;
  expiryDate?: string;
  description?: string;
  branchId?: string;
}

export const inventoryService = {
  // Categories
  getCategories: async (): Promise<InventoryCategory[]> => {
    const response = await api.get<InventoryCategory[]>('/inventory/categories');
    return response.data;
  },

  createCategory: async (payload: { name: string; description?: string; status?: string; productType?: string }): Promise<InventoryCategory> => {
    const response = await api.post<InventoryCategory>('/inventory/categories', payload);
    return response.data;
  },

  updateCategory: async (id: string, payload: { name: string; description?: string; status?: string; productType?: string }): Promise<InventoryCategory> => {
    const response = await api.patch<InventoryCategory>(`/inventory/categories/${id}`, payload);
    return response.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/inventory/categories/${id}`);
  },

  // Items
  getAllItems: async (filters?: {
    branchId?: string;
    categoryId?: string;
    status?: string;
  }): Promise<InventoryItem[]> => {
    const params = {
      ...(filters?.branchId && filters.branchId !== 'ALL' && { branchId: filters.branchId }),
      ...(filters?.categoryId && filters.categoryId !== 'ALL' && { categoryId: filters.categoryId }),
      ...(filters?.status && filters.status !== 'ALL' && { status: filters.status }),
    };
    const response = await api.get<InventoryItem[]>('/inventory', { params });
    return response.data;
  },

  getItemById: async (id: string): Promise<InventoryItem> => {
    const response = await api.get<InventoryItem>(`/inventory/${id}`);
    return response.data;
  },

  createItem: async (payload: CreateInventoryPayload): Promise<InventoryItem> => {
    const response = await api.post<InventoryItem>('/inventory', payload);
    return response.data;
  },

  updateItem: async (id: string, payload: UpdateInventoryPayload): Promise<InventoryItem> => {
    const response = await api.patch<InventoryItem>(`/inventory/${id}`, payload);
    return response.data;
  },

  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/inventory/${id}`);
  },
};
