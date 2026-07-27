export const formatAuditNote = (
  notes: string | null | undefined,
  t: (key: string, options?: any) => string,
): string | null => {
  if (!notes) return null;

  if (notes.startsWith('Process started by technician')) {
    return t('auditLogs.processStartedByTechnician', {
      defaultValue: 'Process started by technician',
    });
  }

  if (
    notes.startsWith('Process paused by technician') ||
    notes.startsWith('Process paused')
  ) {
    return t('auditLogs.processPausedByTechnician', {
      defaultValue: 'Process paused by technician',
    });
  }

  if (
    notes.startsWith('Process resumed by technician') ||
    notes.startsWith('Process resumed')
  ) {
    return t('auditLogs.processResumedByTechnician', {
      defaultValue: 'Process resumed by technician',
    });
  }

  const completedMatch = notes.match(
    /^Process completed\.\s*Active time:\s*(\d+)\s*minutes?\.?/i,
  );
  if (completedMatch) {
    const mins = parseInt(completedMatch[1], 10);
    return t('auditLogs.processCompletedActiveTime', {
      count: mins,
      defaultValue: `Process completed. Active time: ${mins} ${
        mins === 1 ? 'minute' : 'minutes'
      }.`,
    });
  }

  return notes;
};
