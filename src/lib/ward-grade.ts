export interface WardGrade {
  grade: string;
  color: string;
}

/**
 * Composite accountability grade for a ward.
 * Score = fill rate (70 pts max) + response speed (30 pts max).
 * Returns '—' for wards with fewer than 5 potholes (insufficient data).
 */
export function wardGrade(
  fillRate: number,
  avgDays: number | null,
  total: number
): WardGrade {
  if (total < 5) return { grade: '—', color: 'text-zinc-600' };
  let score = (fillRate / 100) * 70;
  if (avgDays !== null) {
    if (avgDays < 14)      score += 30;
    else if (avgDays < 30) score += 22;
    else if (avgDays < 60) score += 15;
    else if (avgDays < 90) score += 7;
  }
  if (score >= 80) return { grade: 'A', color: 'text-green-400' };
  if (score >= 60) return { grade: 'B', color: 'text-sky-400' };
  if (score >= 40) return { grade: 'C', color: 'text-yellow-400' };
  if (score >= 20) return { grade: 'D', color: 'text-orange-400' };
  return { grade: 'F', color: 'text-red-400' };
}
