// ============================================================================
//                                TYPES & INTERFACES
// ============================================================================

interface WeekCalculation {
  current_week: number;
  is_sem_break: boolean;
}

// ============================================================================
//                                UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculates the current academic week based on the semester start date.
 * * Logic:
 * - Weeks 1-7: Standard calculation.
 * - Break Week: Occurs immediately after Week 7 (Days 49-55).
 * - Weeks 8-14: Resumes after break, offsetting the count by 1 week (7 days).
 * * @param startDate - The official start date of the semester (string or Date object)
 * @returns WeekCalculation object containing the week number and break status.
 */
export function calculateCurrentWeek(startDate: string | Date): WeekCalculation {
  const semesterStart = new Date(startDate);
  const today = new Date();

  // Reset time to midnight for accurate day calculation (ignore hours/minutes)
  semesterStart.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // Calculate total days elapsed since semester start
  const msElapsed = today.getTime() - semesterStart.getTime();
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));

  // Case 1: Before semester starts
  if (daysElapsed < 0) {
    return {
      current_week: 1,
      is_sem_break: false
    };
  }

  // Case 2: Weeks 1-7 (Days 0-48 -> 7 weeks * 7 days = 49 days)
  if (daysElapsed < 49) {
    const week = Math.floor(daysElapsed / 7) + 1;
    return {
      current_week: week,
      is_sem_break: false
    };
  }

  // Case 3: Semester Break (Days 49-55 -> 1 week duration)
  // This is the week immediately following Week 7.
  if (daysElapsed < 56) {
    return {
      current_week: 8, // Often displayed as "Break" or "Approaching Week 8"
      is_sem_break: true
    };
  }

  // Case 4: Weeks 8-14 (Days 56-104)
  // We subtract 7 days (the break week) so the count continues from 8 correctly.
  if (daysElapsed < 105) {
    const week = Math.floor((daysElapsed - 7) / 7) + 1;
    return {
      current_week: week,
      is_sem_break: false
    };
  }

  // Case 5: After semester ends (Cap at Week 14)
  return {
    current_week: 14,
    is_sem_break: false
  };
}