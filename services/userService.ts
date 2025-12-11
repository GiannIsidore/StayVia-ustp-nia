import { Database, TablesInsert } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
export type User = Database['public']['Tables']['users']['Row'];

// FETCH ALL USERS

// export const fetchUsers = async (supabase: SupabaseClient<Database>) => {
export async function fetchUsers(supabase: SupabaseClient<Database>): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*');

  if (error) throw error;
  return data ?? [];
}

// FETCH USER BY ID
export const getUserById = async (id: string, supabase: SupabaseClient<Database>) => {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();

  if (error) throw error;
  return data ?? [];
};

// CREATE OR UPDATE USER (handles both new users and existing users)
export const registerUser = async (
  user_data: TablesInsert<'users'>,
  supabase: SupabaseClient<Database>
) => {
  // Use upsert to handle both insert and update scenarios
  // If user with same ID exists, it will update; otherwise, it will insert
  const { data, error } = await supabase
    .from('users')
    .upsert(user_data, {
      onConflict: 'id', // Use 'id' as the conflict target (Clerk user ID)
      ignoreDuplicates: false, // We want to update if exists
    })
    .select();

  if (error) {
    console.error('Database error in registerUser:', error);
    throw error;
  }

  return data;
};

// CHECK IF USER EXISTS BY EMAIL (for early validation)
export const checkUserExistsByEmail = async (
  email: string,
  supabase: SupabaseClient<Database>
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error checking if user exists:', error);
    return false;
  }

  return !!data;
};

// UPDATE USER BY ID
export const updateUser = async (
  id: string,
  user_data: Partial<TablesInsert<'users'>>,
  supabase: SupabaseClient<Database>
) => {
  const { data, error } = await supabase
    .from('users')
    .update(user_data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
