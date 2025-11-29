import { SupabaseClient } from '@supabase/supabase-js';
import type { User, Post } from './types';
import { Database } from '@/types/database.types';

type SupabaseType = SupabaseClient<Database>;

/**
 * Fetch a single user by ID
 */
export async function getUserById(id: string, supabase: SupabaseType): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data as User;
}

/**
 * Fetch posts for a specific user
 */
export async function getPostsByUser(userId: string, supabase: SupabaseType): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      user:users!posts_user_id_fkey (
        id,
        username,
        avatar,
        firstname,
        lastname,
        email
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts for user:', error);
    return [];
  }

  return normalizePosts(data);
}

/**
 * Fetch all posts (with user info)
 */
export async function getAllPosts(supabase: SupabaseType): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      user:users!posts_user_id_fkey (
        id,
        username,
        avatar,
        firstname,
        lastname,
        email
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  return normalizePosts(data);
}

/**
 * Fetch a single post by ID
 */
export async function getPostById(id: string, supabase: SupabaseType): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      *,
      user:users!posts_user_id_fkey (
        id,
        username,
        avatar,
        firstname,
        lastname,
        email
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching post:', error);
    return null;
  }

  return data ? normalizePosts([data])[0] : null;
}

/**
 * Normalize posts: convert filters to string[]
 */
function normalizePosts(rawData: any[]): Post[] {
  return (rawData || []).map((p: any) => {
    let filters: string[] = [];

    if (Array.isArray(p.filters)) {
      filters = p.filters.map(String);
    } else if (p.filters && typeof p.filters === 'object') {
      filters = Object.keys(p.filters).filter((k) => p.filters[k]);
    }

    return { ...p, filters };
  });
}
