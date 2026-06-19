// Per-teacher folders for organising resources. Every read and write goes
// through the auth'd client; RLS restricts all folder and folder_resources
// actions to the folder's owner, so these helpers never need to re-check
// ownership.

import { createClient } from '@/lib/supabase/server';
import type {
  Folder,
  ResourceResult,
  ResourceWithTags,
} from '@/types/resource';
import { getResourcesByIds } from '@/lib/resources/resources';

const FOLDER_COLUMNS = 'id, owner_id, name, created_at';

/** List the current user's folders, newest first. */
export async function listFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('folders')
    .select(FOLDER_COLUMNS)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Folder[];
}

/** Create a folder owned by the current user. */
export async function createFolder(name: string): Promise<ResourceResult<Folder>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('folders')
    .insert({ name })
    .select(FOLDER_COLUMNS)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create folder.' };
  return { ok: true, data: data as Folder };
}

/** Rename a folder. RLS scopes this to the owner. */
export async function renameFolder(
  id: string,
  name: string
): Promise<ResourceResult<Folder>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', id)
    .select(FOLDER_COLUMNS)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Folder not found or not permitted.' };
  return { ok: true, data: data as Folder };
}

/** Delete a folder (its folder_resources entries cascade). */
export async function deleteFolder(id: string): Promise<ResourceResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Add a resource to a folder (idempotent on the (folder, resource) key). */
export async function addResourceToFolder(
  folderId: string,
  resourceId: string
): Promise<ResourceResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('folder_resources')
    .upsert(
      { folder_id: folderId, resource_id: resourceId },
      { onConflict: 'folder_id,resource_id', ignoreDuplicates: true }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Remove a resource from a folder. */
export async function removeResourceFromFolder(
  folderId: string,
  resourceId: string
): Promise<ResourceResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('folder_resources')
    .delete()
    .eq('folder_id', folderId)
    .eq('resource_id', resourceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Move a resource from one folder to another: add to the destination, then
 * remove from the source. Both folders must be owned by the current user (RLS).
 */
export async function moveResourceBetweenFolders(
  fromFolderId: string,
  toFolderId: string,
  resourceId: string
): Promise<ResourceResult> {
  if (fromFolderId === toFolderId) return { ok: true };

  const added = await addResourceToFolder(toFolderId, resourceId);
  if (!added.ok) return added;

  return removeResourceFromFolder(fromFolderId, resourceId);
}

/**
 * List the resources in a folder (with their tags). Reads the folder's resource
 * ids — RLS returns rows only for a folder the user owns — then loads them.
 */
export async function listFolderResources(
  folderId: string
): Promise<ResourceWithTags[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('folder_resources')
    .select('resource_id')
    .eq('folder_id', folderId);

  if (error || !data || data.length === 0) return [];

  const ids = (data as Array<{ resource_id: string }>).map((r) => r.resource_id);
  return getResourcesByIds(ids);
}
