import { generateFolioNumber } from './folio.util';
import { NotFoundException } from '@nestjs/common';

describe('generateFolioNumber', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      branch: {
        findFirst: jest.fn(),
      },
      workOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
  });

  it('should throw NotFoundException if branch is not found', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      generateFolioNumber(mockPrisma, 'tenant1', 'branch1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should generate CRIMA0001 when no existing work orders exist', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ code: 'CRIMA' });
    mockPrisma.workOrder.findMany.mockResolvedValue([]);
    mockPrisma.workOrder.findFirst.mockResolvedValue(null);

    const result = await generateFolioNumber(mockPrisma, 'tenant1', 'branch1');
    expect(result).toBe('CRIMA0001');
  });

  it('should generate CRIMA0022 when CRIMA0020 and CRIMA0021 exist regardless of total record count', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ code: 'CRIMA' });
    mockPrisma.workOrder.findMany.mockResolvedValue([
      { folioNumber: 'CRIMA0018' },
      { folioNumber: 'CRIMA0020' },
      { folioNumber: 'CRIMA0021' },
    ]);
    mockPrisma.workOrder.findFirst.mockResolvedValue(null);

    const result = await generateFolioNumber(mockPrisma, 'tenant1', 'branch1');
    expect(result).toBe('CRIMA0022');
  });

  it('should increment past candidate if safety check finds candidate in DB', async () => {
    mockPrisma.branch.findFirst.mockResolvedValue({ code: 'CRIMA' });
    mockPrisma.workOrder.findMany.mockResolvedValue([
      { folioNumber: 'CRIMA0020' },
    ]);
    // Simulate CRIMA0021 existing in DB when safety check runs once
    mockPrisma.workOrder.findFirst
      .mockResolvedValueOnce({ id: 'wo-21' })
      .mockResolvedValueOnce(null);

    const result = await generateFolioNumber(mockPrisma, 'tenant1', 'branch1');
    expect(result).toBe('CRIMA0022');
  });
});
