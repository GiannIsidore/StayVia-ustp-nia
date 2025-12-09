import { useUser } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/supabase';
import { getUserById } from '@/services/userService';

export function useAccountType() {
  const { user } = useUser();
  const supabase = useSupabase();
  const id = user?.id;

  const { data, error, isLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserById(id as string, supabase),
    enabled: !!id,
  });

  const accountType = data?.account_type ?? null;
  const isUser = accountType === 'student';

  const isLandlord = accountType === 'landlord';

  return {
    accountType,
    isUser,
    isLandlord,
    error,
    isLoading,
  };
}
