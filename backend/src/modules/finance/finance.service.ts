import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkOrderStatus } from '@prisma/client';

interface PaymentHistoryItem {
  amount: number;
  notes?: string;
  date: string;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private parsePaymentsFromNotes(notes: string | null, createdAt: Date, initialPayment: number): { amount: number; date: Date }[] {
    const list: { amount: number; date: Date }[] = [];
    if (notes) {
      const startTag = '<!-- PAYMENTS_START -->';
      const endTag = '<!-- PAYMENTS_END -->';
      const startIndex = notes.indexOf(startTag);
      const endIndex = notes.indexOf(endTag);
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = notes.substring(startIndex + startTag.length, endIndex).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && typeof item.amount === 'number') {
                list.push({
                  amount: item.amount,
                  date: item.date ? new Date(item.date) : new Date(),
                });
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    const sumOfLogged = list.reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = initialPayment || 0;
    if (totalPaid > sumOfLogged) {
      const diff = totalPaid - sumOfLogged;
      list.unshift({
        amount: diff,
        date: new Date(createdAt),
      });
    }

    return list;
  }

  private getMonthsInRange(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const start = new Date(startDate.getTime());
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate.getTime());
    end.setDate(1);
    end.setHours(0, 0, 0, 0);

    while (start <= end) {
      const year = start.getFullYear();
      const month = String(start.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
      start.setMonth(start.getMonth() + 1);
    }
    return months;
  }

  async getFinanceStats(
    tenantId: string,
    startDateStr: string,
    endDateStr: string,
    branchIdsFilter?: string,
  ) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    let branchIdList: string[] = [];
    if (branchIdsFilter && branchIdsFilter !== 'ALL') {
      branchIdList = branchIdsFilter.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
    }

    // 1. Fetch all work orders for branch/tenant
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        status: { not: WorkOrderStatus.CANCELLED },
        ...(branchIdList.length > 0 && { branchId: { in: branchIdList } }),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        doctor: { select: { id: true, name: true, clinicName: true } },
      },
    });

    // 2. Fetch all branches to ensure we can build the branch comparison correctly even if some branches have 0 data
    const allBranches = await this.prisma.branch.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(branchIdList.length > 0 && { id: { in: branchIdList } }),
      },
    });

    // 3. Reconstruct payment history
    const reconstructedPayments: { amount: number; date: Date; branchId: string | null; branchName: string; workOrder: any }[] = [];
    for (const wo of workOrders) {
      const pms = this.parsePaymentsFromNotes(wo.notes, wo.createdAt, wo.initialPayment || 0);
      for (const p of pms) {
        reconstructedPayments.push({
          amount: p.amount,
          date: p.date,
          branchId: wo.branchId,
          branchName: wo.branch?.name || 'Unassigned',
          workOrder: wo,
        });
      }
    }

    // 4. Filter work orders and payments by date range
    const workOrdersInRange = workOrders.filter(
      (wo) => wo.createdAt >= startDate && wo.createdAt <= endDate,
    );
    const paymentsInRange = reconstructedPayments.filter(
      (p) => p.date >= startDate && p.date <= endDate,
    );

    // 5. Calculate global metrics
    const totalQuotedAmount = workOrdersInRange.reduce((sum, wo) => sum + (wo.totalQuote || 0), 0);
    const totalPaidAmount = paymentsInRange.reduce((sum, p) => sum + p.amount, 0);

    // Cumulative outstanding: Outstanding = totalQuote - initialPayment (for active work orders created up to endDate)
    const activeWorkOrdersUpToDate = workOrders.filter((wo) => wo.createdAt <= endDate);
    const totalOutstandingAmount = activeWorkOrdersUpToDate.reduce((sum, wo) => {
      const balance = (wo.totalQuote || 0) - (wo.initialPayment || 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0);

    const paidWorkOrdersCount = workOrdersInRange.filter(
      (wo) => (wo.totalQuote || 0) > 0 && (wo.initialPayment || 0) >= (wo.totalQuote || 0),
    ).length;

    const pendingPaymentWorkOrdersCount = workOrdersInRange.filter(
      (wo) => (wo.totalQuote || 0) > 0 && (wo.initialPayment || 0) < (wo.totalQuote || 0),
    ).length;

    const collectionPercentage = totalQuotedAmount > 0 ? (totalPaidAmount / totalQuotedAmount) * 100 : 0;

    const monthsList = this.getMonthsInRange(startDate, endDate);
    const numMonths = Math.max(1, monthsList.length);
    const averageMonthlyRevenue = totalQuotedAmount / numMonths;

    // 6. Branch performance aggregation
    const branchStatsMap = new Map<string, {
      branchId: string | null;
      branchName: string;
      quotedAmount: number;
      paidAmount: number;
      outstandingAmount: number;
      paidWorkOrdersCount: number;
      pendingPaymentWorkOrdersCount: number;
    }>();

    // Initialize map with all active branches
    for (const b of allBranches) {
      branchStatsMap.set(b.id, {
        branchId: b.id,
        branchName: b.name,
        quotedAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        paidWorkOrdersCount: 0,
        pendingPaymentWorkOrdersCount: 0,
      });
    }

    // Add unassigned placeholder if needed
    const unassignedKey = 'UNASSIGNED';
    if (workOrders.some((wo) => !wo.branchId)) {
      branchStatsMap.set(unassignedKey, {
        branchId: null,
        branchName: 'Unassigned',
        quotedAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        paidWorkOrdersCount: 0,
        pendingPaymentWorkOrdersCount: 0,
      });
    }

    // Populate quoted amount and work order counts for branches
    for (const wo of workOrdersInRange) {
      const key = wo.branchId || unassignedKey;
      let stat = branchStatsMap.get(key);
      if (!stat) {
        stat = {
          branchId: wo.branchId,
          branchName: wo.branch?.name || 'Unassigned',
          quotedAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          paidWorkOrdersCount: 0,
          pendingPaymentWorkOrdersCount: 0,
        };
        branchStatsMap.set(key, stat);
      }
      stat.quotedAmount += wo.totalQuote || 0;
      if ((wo.totalQuote || 0) > 0 && (wo.initialPayment || 0) >= (wo.totalQuote || 0)) {
        stat.paidWorkOrdersCount++;
      } else if ((wo.totalQuote || 0) > 0 && (wo.initialPayment || 0) < (wo.totalQuote || 0)) {
        stat.pendingPaymentWorkOrdersCount++;
      }
    }

    // Populate paid amount (collections) for branches
    for (const p of paymentsInRange) {
      const key = p.branchId || unassignedKey;
      let stat = branchStatsMap.get(key);
      if (!stat) {
        stat = {
          branchId: p.branchId,
          branchName: p.branchName,
          quotedAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          paidWorkOrdersCount: 0,
          pendingPaymentWorkOrdersCount: 0,
        };
        branchStatsMap.set(key, stat);
      }
      stat.paidAmount += p.amount;
    }

    // Populate cumulative outstanding amount for branches
    for (const wo of activeWorkOrdersUpToDate) {
      const key = wo.branchId || unassignedKey;
      let stat = branchStatsMap.get(key);
      if (!stat) {
        stat = {
          branchId: wo.branchId,
          branchName: wo.branch?.name || 'Unassigned',
          quotedAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          paidWorkOrdersCount: 0,
          pendingPaymentWorkOrdersCount: 0,
        };
        branchStatsMap.set(key, stat);
      }
      const balance = (wo.totalQuote || 0) - (wo.initialPayment || 0);
      stat.outstandingAmount += balance > 0 ? balance : 0;
    }

    const branchPerformance = Array.from(branchStatsMap.values()).map((stat) => ({
      ...stat,
      collectionPercentage: stat.quotedAmount > 0 ? (stat.paidAmount / stat.quotedAmount) * 100 : 0,
    }));

    // Find top performing branch
    let topBranchName = 'N/A';
    let topBranchRevenue = 0;
    for (const b of branchPerformance) {
      if (b.quotedAmount > topBranchRevenue) {
        topBranchRevenue = b.quotedAmount;
        topBranchName = b.branchName;
      }
    }
    const topPerformingBranch = {
      name: topBranchName,
      revenue: topBranchRevenue,
    };

    // 7. Monthly revenue trends
    const monthlyTrends = monthsList.map((m) => {
      const wosInMonth = workOrdersInRange.filter((wo) => {
        const woMonth = wo.createdAt.toISOString().substring(0, 7);
        return woMonth === m;
      });
      const paymentsInMonth = paymentsInRange.filter((p) => {
        const pMonth = p.date.toISOString().substring(0, 7);
        return pMonth === m;
      });

      const quoted = wosInMonth.reduce((sum, wo) => sum + (wo.totalQuote || 0), 0);
      const paid = paymentsInMonth.reduce((sum, p) => sum + p.amount, 0);

      const [year, month] = m.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      return {
        month: m,
        label,
        quotedAmount: quoted,
        paidAmount: paid,
      };
    });

    // 8. Payment status distribution
    const paymentStatusDistribution = {
      paidCount: paidWorkOrdersCount,
      pendingCount: pendingPaymentWorkOrdersCount,
    };

    return {
      summary: {
        totalQuotedAmount,
        totalPaidAmount,
        totalOutstandingAmount,
        paidWorkOrdersCount,
        pendingPaymentWorkOrdersCount,
        collectionPercentage,
        averageMonthlyRevenue,
        topPerformingBranch,
        pendingPaymentCount: pendingPaymentWorkOrdersCount,
      },
      branchPerformance,
      monthlyTrends,
      paymentStatusDistribution,
    };
  }

  async getPendingPayments(
    tenantId: string,
    startDateStr: string,
    endDateStr: string,
    branchIdsFilter?: string,
    page = 1,
    limit = 10,
    search = '',
  ) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    let branchIdList: string[] = [];
    if (branchIdsFilter && branchIdsFilter !== 'ALL') {
      branchIdList = branchIdsFilter.split(',').map((id) => id.trim()).filter((id) => id.length > 0);
    }

    const whereClause: any = {
      tenantId,
      status: { not: WorkOrderStatus.CANCELLED },
      createdAt: { gte: startDate, lte: endDate },
      ...(branchIdList.length > 0 && { branchId: { in: branchIdList } }),
    };

    if (search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { folioNumber: { contains: q, mode: 'insensitive' } },
        { patient: { contains: q, mode: 'insensitive' } },
        { doctor: { name: { contains: q, mode: 'insensitive' } } },
        { doctor: { clinicName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const candidates = await this.prisma.workOrder.findMany({
      where: whereClause,
      include: {
        branch: { select: { name: true, code: true } },
        doctor: { select: { name: true, clinicName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingWOs = candidates.filter((wo) => {
      const quote = wo.totalQuote || 0;
      const paid = wo.initialPayment || 0;
      return quote > paid;
    });

    const totalCount = pendingWOs.length;
    const startIndex = (page - 1) * limit;
    const paginatedWOs = pendingWOs.slice(startIndex, startIndex + limit);

    const data = paginatedWOs.map((wo) => {
      const quote = wo.totalQuote || 0;
      const paid = wo.initialPayment || 0;
      const outstanding = quote - paid;
      
      const dueDate = new Date(wo.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      return {
        id: wo.id,
        folioNumber: wo.folioNumber,
        patient: wo.patient,
        doctorName: wo.doctor?.name || 'N/A',
        clinicName: wo.doctor?.clinicName || null,
        branchName: wo.branch?.name || 'Unassigned',
        branchCode: wo.branch?.code || null,
        totalQuote: quote,
        initialPayment: paid,
        outstandingAmount: outstanding,
        createdAt: wo.createdAt,
        dueDate: dueDate,
        status: wo.status,
      };
    });

    return {
      data,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }
}
