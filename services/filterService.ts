import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type SupabaseType = SupabaseClient<Database>;

// FILTER SEARCH

export const filterPostsByTitle = async (search: string, supabase: SupabaseType) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users!posts_user_id_fkey(*)')
    .ilike('title', `%${search}%`);

  if (error) throw error;
  return data ?? [];
};

export const filterPostsByDesc = async (search: string, supabase: SupabaseType) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users!posts_user_id_fkey(*)')
    .ilike('description', `%${search}%`);

  if (error) throw error;
  return data ?? [];
};

export const filterPostsByFname = async (search: string, supabase: SupabaseType) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users!posts_user_id_fkey(*)')
    .ilike('user.firstname', `%${search}%`);

  if (error) throw error;
  return data ?? [];
};

export const filterPostsByLname = async (search: string, supabase: SupabaseType) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users!posts_user_id_fkey(*)')
    .ilike('user->lastname', `%${search}%`);

  if (error) throw error;
  return data ?? [];
};
