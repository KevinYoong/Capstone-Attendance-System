interface WeekCalculation {
  current_week: number;
  is_sem_break: boolean;
}

export function calculateCurrentWeek(startDate: string | Date): WeekCalculation {
  const semesterStart = new Date(startDate);
  const today = new Date();

  // Reset time to midnight for accurate day calculation
  semesterStart.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // Calculate days elapsed since semester start
  const msElapsed = today.getTime() - semesterStart.getTime();
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));

  // Before semester starts
  if (daysElapsed < 0) {
    return {
      current_week: 1,
      is_sem_break: false
    };
  }

  // Week 1-7 (Days 0-48: 49 days total)
  if (daysElapsed < 49) {
    const week = Math.floor(daysElapsed / 7) + 1;
    return {
      current_week: week,
      is_sem_break: false
    };
  }

  // Semester Break (Days 49-55: 7 days)
  if (daysElapsed < 56) {
    return {
      current_week: 8, // Display as "approaching week 8" or could be 7
      is_sem_break: true
    };
  }

  // Week 8-14 (Days 56-104: 49 days)
  // Subtract 7 days for the break week that doesn't count
  if (daysElapsed < 105) {
    const week = Math.floor((daysElapsed - 7) / 7) + 1;
    return {
      current_week: week,
      is_sem_break: false
    };
  }

  // After semester ends
  return {
    current_week: 14,
    is_sem_break: false
  };
}