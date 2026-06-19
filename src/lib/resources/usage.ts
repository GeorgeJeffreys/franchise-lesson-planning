// Resource usage tracking. Recording a use inserts a resource_usage row (RLS:
// used_by must be the current user); a database trigger bumps the resource's
// usage_count. Popularity overall is that usage_count; a teacher's personal
// "Most used" is an aggregate over their own resource_usage rows.

import { createClient } from '@/lib/supabase/server';
import { getResourcesByIds } from '@/lib/resources/resources';
import type { ResourceResult, ResourceWithTags } from '@/types/resource';

/**
 * Record that the current user used a resource, optionally in the context of a
 * lesson plan. The usage_count trigger increments the resource's tally.
 */
export async function recordUsage(
  resourceId: string,
  lessonPlanId?: string
): Promise<ResourceResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('resource_usage').insert({
    resource_id: resourceId,
    lesson_plan_id: lessonPlanId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** A resource paired with how many times the current user has used it. */
export interface MostUsedResource {
  resource: ResourceWithTags;
  useCount: number;
}

/**
 * The current user's most-used resources, most-frequent first. Aggregates the
 * user's own resource_usage rows (RLS already scopes the select to them), then
 * loads the underlying resources.
 */
export async function getMostUsed(limit = 10): Promise<MostUsedResource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('resource_usage')
    .select('resource_id');

  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as Array<{ resource_id: string }>) {
    counts.set(row.resource_id, (counts.get(row.resource_id) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const resources = await getResourcesByIds(ranked.map(([id]) => id));
  const byId = new Map(resources.map((r) => [r.id, r]));

  const result: MostUsedResource[] = [];
  for (const [id, useCount] of ranked) {
    const resource = byId.get(id);
    if (resource) result.push({ resource, useCount });
  }
  return result;
}
