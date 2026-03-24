import type { Councillor } from '$lib/wards';
import type { Pothole } from '$lib/types';

/**
 * Builds a mailto: URL pre-filled with a ward-level accountability message.
 * Used on ward profile pages where there is no single pothole to reference.
 */
export function getWardEmailUrl(
  councillor: Councillor,
  fillRate: number | null,
  openCount: number,
  wardUrl: string
): string {
  const subject = `Pothole accountability — Ward ${councillor.ward}`;
  const fillLine = fillRate !== null
    ? `Current fill rate: ${fillRate.toFixed(0)}%`
    : '';
  const body = `Hi ${councillor.name},

I'm writing about the pothole situation in Ward ${councillor.ward}.

${fillLine}
Open potholes right now: ${openCount}
Ward accountability page: ${wardUrl}

Residents are tracking these potholes and would appreciate faster action on repairs.

Thank you.`;
  return `mailto:${councillor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Builds a mailto: URL pre-filled with details about a specific pothole.
 * Moved from hole/[id]/+page.svelte to allow reuse.
 */
export function getPotholeEmailUrl(councillor: Councillor, pothole: Pothole): string {
  const subject = `Pothole at ${pothole.address || 'my location'}`;
  const body = `Hi ${councillor.name},

I'd like to report an unfilled pothole in Ward ${councillor.ward}.

Location: ${pothole.address || `${pothole.lat.toFixed(4)}, ${pothole.lng.toFixed(4)}`}
Tracked at: https://fillthehole.ca/hole/${pothole.id}

This pothole has been reported and is awaiting city action. Please help get it on the city's radar.

Thank you.`;
  return `mailto:${councillor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
