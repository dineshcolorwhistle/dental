import api from './api';

export type WhatsAppTemplateStatus = 'ACTIVE' | 'INACTIVE';

export interface WhatsAppTemplate {
  id: string;
  tenantId: string;
  name: string;
  triggerEvent?: string | null;
  message: string;
  status: WhatsAppTemplateStatus;
  placeholders: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppTemplatePayload {
  name: string;
  triggerEvent?: string | null;
  message: string;
  status?: WhatsAppTemplateStatus;
  placeholders?: string[];
}

export interface UpdateWhatsAppTemplatePayload {
  name?: string;
  triggerEvent?: string | null;
  message?: string;
  status?: WhatsAppTemplateStatus;
  placeholders?: string[];
}

export const whatsappTemplateService = {
  async getAll(): Promise<WhatsAppTemplate[]> {
    const response = await api.get<WhatsAppTemplate[]>('/whatsapp-templates');
    return response.data;
  },

  async getById(id: string): Promise<WhatsAppTemplate> {
    const response = await api.get<WhatsAppTemplate>(`/whatsapp-templates/${id}`);
    return response.data;
  },

  async create(payload: CreateWhatsAppTemplatePayload): Promise<WhatsAppTemplate> {
    const response = await api.post<WhatsAppTemplate>('/whatsapp-templates', payload);
    return response.data;
  },

  async update(id: string, payload: UpdateWhatsAppTemplatePayload): Promise<WhatsAppTemplate> {
    const response = await api.put<WhatsAppTemplate>(`/whatsapp-templates/${id}`, payload);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/whatsapp-templates/${id}`);
  },
};
