import api from './api';

// ─── Types ───────────────────────────────────────────────

export interface FinanceStats {
  summary: {
    totalQuotedAmount: number;
    totalPaidAmount: number;
    totalOutstandingAmount: number;
    paidWorkOrdersCount: number;
    pendingPaymentWorkOrdersCount: number;
    collectionPercentage: number;
    averageMonthlyRevenue: number;
    topPerformingBranch: {
      name: string;
      revenue: number;
    };
    pendingPaymentCount: number;
  };
  branchPerformance: {
    branchId: string | null;
    branchName: string;
    quotedAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    paidWorkOrdersCount: number;
    pendingPaymentWorkOrdersCount: number;
    collectionPercentage: number;
  }[];
  monthlyTrends: {
    month: string;
    label: string;
    quotedAmount: number;
    paidAmount: number;
  }[];
  paymentStatusDistribution: {
    paidCount: number;
    pendingCount: number;
  };
}

export interface PendingPaymentWorkOrder {
  id: string;
  folioNumber: string;
  patient: string;
  doctorName: string;
  clinicName: string | null;
  branchName: string;
  branchCode: string | null;
  totalQuote: number;
  initialPayment: number;
  outstandingAmount: number;
  createdAt: string;
  dueDate: string;
  status: string;
}

export interface PendingPaymentsResponse {
  data: PendingPaymentWorkOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GetFinanceParams {
  startDate: string;
  endDate: string;
  branchIds?: string;
}

export interface GetPendingPaymentsParams extends GetFinanceParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface DoctorBalanceWorkOrder {
  id: string;
  folioNumber: string;
  patient: string | null;
  totalQuote: number;
  initialPayment: number;
  balance: number;
  status: string;
  createdAt: string;
  deliveryDate: string | null;
  isPaid: boolean;
}

export interface DoctorBalanceItem {
  doctorId: string;
  doctorName: string;
  clinicName: string | null;
  clinicId: string | null;
  email: string | null;
  phone: string | null;
  branchName: string;
  branchCode: string | null;
  branchId: string | null;
  totalOrders: number;
  totalQuoted: number;
  totalPaid: number;
  pendingBalance: number;
  paidOrdersCount: number;
  unpaidOrdersCount: number;
  pendingWorkOrders: DoctorBalanceWorkOrder[];
  allWorkOrders: DoctorBalanceWorkOrder[];
}

export interface DoctorBalancesResponse {
  summary: {
    totalOutstanding: number;
    totalQuoted: number;
    totalPaid: number;
    totalDoctorsWithPending: number;
    totalDoctors: number;
  };
  data: DoctorBalanceItem[];
}

export interface GetDoctorBalancesParams {
  branchIds?: string;
  search?: string;
  onlyWithPending?: boolean;
}

// ─── Service ─────────────────────────────────────────────

export const financeService = {
  getStats: async (params: GetFinanceParams): Promise<FinanceStats> => {
    const { data } = await api.get<FinanceStats>('/finance/stats', { params });
    return data;
  },

  getPendingPayments: async (params: GetPendingPaymentsParams): Promise<PendingPaymentsResponse> => {
    const { data } = await api.get<PendingPaymentsResponse>('/finance/pending-payments', { params });
    return data;
  },

  getDoctorBalances: async (params?: GetDoctorBalancesParams): Promise<DoctorBalancesResponse> => {
    const { data } = await api.get<DoctorBalancesResponse>('/finance/doctor-balances', { params });
    return data;
  },
};
