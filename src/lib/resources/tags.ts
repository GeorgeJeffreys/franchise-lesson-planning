// Resource-bank tag vocabulary: read the coordinator-managed tags grouped by
// dimension, plus coordinator-only tag CRUD. Everything goes through the auth'd,
// cookie-bound Supabase client, so RLS enforces "coordinator only" on writes —
// these helpers surface a friendly error rather than re-checking the role.

import { createClient } from '@/lib/supabase/server';
import type {
  CreateTagInput,
  ResourceResult,
  ResourceTag,
  TagDimension,
  TagsByDimension,
  UpdateTagInput,
} from '@/types/resource';

const DIMENSIONS: TagDimension[] = [
  'theme',
  'format',
  'exercise_type',
  'lesson_stage',
  'skill_type',
  'grammar_content',
  'localisation',
];

/** An empty {dimension: []} map, so callers can index every dimension safely. */
function emptyTagsByDimension(): TagsByDimension {
  return DIMENSIONS.reduce((acc, d) => {
    acc[d] = [];
    return acc;
  }, {} as TagsByDimension);
}

/**
 * Fetch the full tag vocabulary, optionally narrowed to a subject (subject-scoped
 * tags for that subject plus all global tags), grouped by dimension and ordered
 * by sort_order then label.
 */
export async function getTagVocabulary(subjectId?: string): Promise<TagsByDimension> {
  const supabase = await createClient();

  let query = supabase
    .from('resource_tags')
    .select('id, dimension, label, subject_id, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (subjectId) {
    query = query.or(`subject_id.is.null,subject_id.eq.${subjectId}`);
  }

  const { data, error } = await query;
  const grouped = emptyTagsByDimension();
  if (error || !data) return grouped;

  for (const tag of data as ResourceTag[]) {
    (grouped[tag.dimension] ??= []).push(tag);
  }
  return grouped;
}

/** Flat list of all tags (unordered grouping), for callers that don't need the map. */
export async function listTags(): Promise<ResourceTag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resource_tags')
    .select('id, dimension, label, subject_id, sort_order, created_at')
    .order('dimension', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return data as ResourceTag[];
}

/** Create a tag. RLS restricts this to coordinators. */
export async function createTag(
  input: CreateTagInput
): Promise<ResourceResult<ResourceTag>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resource_tags')
    .insert({
      dimension: input.dimension,
      label: input.label,
      subject_id: input.subjectId ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select('id, dimension, label, subject_id, sort_order, created_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Not permitted to create tags.' };
  return { ok: true, data: data as ResourceTag };
}

/** Update a tag's label and/or sort order. RLS restricts this to coordinators. */
export async function updateTag(
  id: string,
  input: UpdateTagInput
): Promise<ResourceResult<ResourceTag>> {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resource_tags')
    .update(patch)
    .eq('id', id)
    .select('id, dimension, label, subject_id, sort_order, created_at')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Tag not found or not permitted.' };
  return { ok: true, data: data as ResourceTag };
}

/** Delete a tag (cascades to its resource_tag_links). RLS: coordinators only. */
export async function deleteTag(id: string): Promise<ResourceResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('resource_tags').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
