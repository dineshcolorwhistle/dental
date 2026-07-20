import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generate the next folio number for a branch.
 * Format: <BranchCode><4-digit sequential> e.g. CRIMA0022
 *
 * This function calculates the next sequential number by parsing all existing
 * numerical suffixes for work orders under the branch code in the tenant, ensuring
 * that deleted work orders or out-of-order folios do not cause collisions or 500 errors.
 */
export async function generateFolioNumber(
  prisma: PrismaService,
  tenantId: string,
  branchId: string,
): Promise<string> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { code: true },
  });

  if (!branch) {
    throw new NotFoundException(`Branch with ID "${branchId}" not found.`);
  }

  // Fetch all existing folio numbers for this tenant starting with branch code
  const existingWorkOrders = await prisma.workOrder.findMany({
    where: {
      tenantId,
      folioNumber: {
        startsWith: branch.code,
      },
    },
    select: {
      folioNumber: true,
    },
  });

  let maxNum = 0;
  const prefixLength = branch.code.length;

  for (const wo of existingWorkOrders) {
    const suffix = wo.folioNumber.substring(prefixLength);
    const match = suffix.match(/^(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `${branch.code}${nextNum.toString().padStart(4, '0')}`;

  // Safety fallback loop to ensure uniqueness
  while (
    await prisma.workOrder.findFirst({
      where: { tenantId, folioNumber: candidate },
      select: { id: true },
    })
  ) {
    nextNum++;
    candidate = `${branch.code}${nextNum.toString().padStart(4, '0')}`;
  }

  return candidate;
}
