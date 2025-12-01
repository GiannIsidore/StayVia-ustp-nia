import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function LandlordRentalsPage() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = useSupabase();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id;

  // Fetch all posts owned by this user
  const { data: userPosts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['userPosts', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('posts')
        .select('id, title, price_per_night, location, image')
        .eq('user_id', userId);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Fetch all approved requests for user's posts
  const {
    data: approvedRequests = [],
    isLoading: isLoadingRequests,
    error: requestsError,
  } = useQuery({
    queryKey: ['approvedRequests', userId, userPosts],
    queryFn: async () => {
      if (!userId || !userPosts?.length) return [];

      const postIds = userPosts.map((p) => p.id);

      const { data, error } = await supabase
        .from('requests')
        .select(
          `
          *,
          users:user_id(id, firstname, lastname, avatar, email),
          posts:post_id(id, title, price_per_night)
        `
        )
        .in('post_id', postIds)
        .eq('confirmed', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching approved requests:', error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!userId && !!userPosts?.length,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['userPosts', userId] });
    await queryClient.refetchQueries({ queryKey: ['approvedRequests', userId, userPosts] });
    setRefreshing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getTenantName = (users: any) => {
    return users ? `${users.firstname || ''} ${users.lastname || ''}`.trim() : 'Tenant';
  };

  const getRentalCard = (rental: any) => {
    return (
      <TouchableOpacity
        key={rental.id}
        onPress={() => {
          router.push({
            pathname: `/(protected)/landlord-rentals/[id]`,
            params: { id: rental.id },
          });
        }}
        className="mb-3 rounded-lg border p-4"
        style={{ borderColor: colors.border, backgroundColor: colors.card }}>
        {/* Header: Tenant Name and Status */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
              {getTenantName(rental.users)}
            </Text>
            <Text className="text-xs text-gray-500">{rental.posts?.title || 'Property'}</Text>
          </View>
          <View className="items-end">
            <View className="flex-row items-center gap-1">
              <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
              <Text className="text-xs font-semibold" style={{ color: '#3B82F6' }}>
                Active
              </Text>
            </View>
          </View>
        </View>

        {/* Rental Dates */}
        <Text className="mb-2 text-sm text-gray-500">
          📅 {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
        </Text>

        {/* Monthly Rent */}
        {rental.monthly_rent_amount ? (
          <Text className="mb-2 text-sm font-semibold" style={{ color: colors.foreground }}>
            ₱{rental.monthly_rent_amount.toLocaleString()} / month
          </Text>
        ) : null}

        {/* Tenant Contact */}
        <View
          className="flex-row items-center justify-between border-t pt-2"
          style={{ borderColor: colors.border }}>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">Tenant Email</Text>
            <Text className="text-xs font-medium" style={{ color: colors.foreground }}>
              {rental.users?.email || 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isLoading = isLoadingPosts || isLoadingRequests;

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Show error if requests failed to load
  if (requestsError) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="mt-4 text-center text-lg font-semibold text-gray-900 dark:text-white">
            Error Loading Rentals
          </Text>
          <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {(requestsError as any)?.message || 'Failed to fetch approved rentals'}
          </Text>
          <TouchableOpacity onPress={onRefresh} className="mt-6 rounded-lg bg-blue-600 px-6 py-3">
            <Text className="font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        className="px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View className="mb-6 mt-4 flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>
              🏠 My Rentals
            </Text>
            <Text className="mt-1 text-sm text-gray-500">Active tenant agreements</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push('/(protected)/landlord-rentals/payment-calendar')}
              className="rounded-full p-2"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Ionicons name="calendar" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(protected)/home')}
              className="rounded-full p-2"
              style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <Ionicons name="home" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Card */}
        <View className="mb-6 rounded-lg p-4" style={{ backgroundColor: '#3B82F6' }}>
          <Text className="text-3xl font-bold text-white">{approvedRequests.length}</Text>
          <Text className="mt-1 text-sm text-blue-100">Active Rentals</Text>
        </View>

        {/* Rentals List */}
        {approvedRequests.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Ionicons name="briefcase-outline" size={48} color={colors.foreground} />
            <Text className="mt-4 text-center text-gray-500">No active rentals</Text>
            <Text className="text-center text-sm text-gray-400">
              {userPosts?.length === 0
                ? 'Create a post first to accept tenants'
                : 'Approve requests to see rentals here'}
            </Text>
          </View>
        ) : (
          approvedRequests.map((rental) => getRentalCard(rental))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
