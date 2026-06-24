// Derive a resource's display "format" (the badge on bank cards and from-bank
// blocks) from its backing file extension, external URL, or an explicit `format`
// tag. Also resolves the badge colours used across the worksheet builder, which
// mirror the mockup's format palette.

import type { ResourceWithTags } from '@/types/resource';

export type ResourceFormat = 'IMG' | 'PDF' | 'DOC' | 'LINK' | 'AUDIO' | 'FILE';

const FORMAT_COLORS: Record<ResourceFormat, { color: string; bg: string }> = {
  IMG: { color: '#B0651E', bg: '#F6ECDA' },
  PDF: { color: '#B62A5C', bg: '#FBEFF3' },
  LINK: { color: '#2E7D5B', bg: '#E2F0E8' },
  DOC: { color: '#1F7A6C', bg: '#E4F0ED' },
  AUDIO: { color: '#B0651E', bg: '#F6ECDA' },
  FILE: { color: '#5C544E', bg: '#F1ECE3' },
};

const EXT_MAP: Record<string, ResourceFormat> = {
  png: 'IMG', jpg: 'IMG', jpeg: 'IMG', gif: 'IMG', webp: 'IMG', svg: 'IMG', heic: 'IMG',
  pdf: 'PDF',
  doc: 'DOC', docx: 'DOC', odt: 'DOC', rtf: 'DOC', txt: 'DOC',
  mp3: 'AUDIO', wav: 'AUDIO', m4a: 'AUDIO', ogg: 'AUDIO', aac: 'AUDIO',
};

/** Map a resource to its format short-code. */
export function resourceFormat(resource: ResourceWithTags): ResourceFormat {
  // An explicit format tag wins, if it maps cleanly.
  const formatTag = resource.tags.find((t) => t.dimension === 'format');
  if (formatTag) {
    const label = formatTag.label.toLowerCase();
    if (label.includes('image') || label.includes('img')) return 'IMG';
    if (label.includes('pdf')) return 'PDF';
    if (label.includes('audio')) return 'AUDIO';
    if (label.includes('link')) return 'LINK';
    if (label.includes('word') || label.includes('doc')) return 'DOC';
  }
  if (!resource.file_path && resource.external_url) return 'LINK';
  const ext = resource.file_path?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'FILE';
}

/** Badge colours for a format. */
export function formatColors(format: ResourceFormat): { color: string; bg: string } {
  return FORMAT_COLORS[format];
}

/** Initials for an avatar (e.g. "Layla Haddad" → "LH"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A deterministic avatar background colour from a name (mockup's three hues). */
export function avatarColor(name: string): string {
  const palette = ['#1F7A6C', '#B62A5C', '#B0651E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
