export const formatDuration = (secs: number | null | undefined): string => {
  if (!secs || secs <= 0) return '0s';
  const totalSecs = Math.round(secs);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const remainingSecs = totalSecs % 60;
  if (mins < 60) {
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
};

export const extractDurationFromNote = (notes?: string | null): string | null => {
  if (!notes) return null;
  // Match compound e.g. "Active time: 1h 20m 10s" or "Active time: 2m 15s" or "Active time: 45s"
  const formattedMatch = notes.match(/Active time:\s*(\d+h\s*\d+m(?:\s*\d+s)?|\d+m\s*\d+s|\d+s)/i);
  if (formattedMatch) return formattedMatch[1].trim();

  // Match "Active time: X minutes" or "Duration: X minutes"
  const minMatch = notes.match(/(?:Active time|Duration):\s*(\d+)\s*minutes?/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return mins === 1 ? '1m' : `${mins}m`;
  }
  return null;
};

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

  const detailedCompletedMatch = notes.match(
    /^Process completed\.\s*Active time:\s*([^\.]+)\.?/i,
  );
  if (detailedCompletedMatch) {
    return `Process completed. Active time: ${detailedCompletedMatch[1]}.`;
  }

  return notes;
};
