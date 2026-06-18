import type { TeachingPhase } from '@/types/lesson';

/** Short badge label for a phase, used in the left sidebar. */
export function phaseTag(phase: TeachingPhase | null): string | null {
  switch (phase) {
    case 'i_do':
      return 'I DO';
    case 'we_do':
      return 'WE DO';
    case 'you_do':
      return 'YOU DO';
    default:
      return null;
  }
}

/** Long label for the phase dropdown. */
export function phaseLabel(phase: TeachingPhase | null): string {
  switch (phase) {
    case 'i_do':
      return 'I do';
    case 'we_do':
      return 'We do';
    case 'you_do':
      return 'You do';
    default:
      return 'No phase';
  }
}

/** The dropdown options, in order. `null` = "No phase". */
export const PHASE_OPTIONS: { value: TeachingPhase | ''; label: string }[] = [
  { value: '', label: 'No phase' },
  { value: 'i_do', label: 'I do' },
  { value: 'we_do', label: 'We do' },
  { value: 'you_do', label: 'You do' },
];

/** Parse a dropdown string value back into a phase (or null). */
export function parsePhase(value: string): TeachingPhase | null {
  return value === 'i_do' || value === 'we_do' || value === 'you_do' ? value : null;
}
