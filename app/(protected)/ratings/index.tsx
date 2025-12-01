import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getRentalsDueForRating, getActiveRentals } from '@/services/requestService';

export default function RatingsPage() {
  const { session } = useSession();
  const router = useRouter();
  const supabase = useSupabase();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  const userId = session?.user?.id;

  // Refresh data when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['rentalsDueForRating', userId] });
        queryClient.invalidateQueries({ queryKey: ['activeRentals', userId] });
        queryClient.invalidateQueries({ queryKey: ['userRatings', userId] });
      }
    }, [userId, queryClient])
  );

  // Fetch rentals due for rating
  const { data: rentalsDueForRating, isLoading: isLoadingDue } = useQuery({
    queryKey: ['rentalsDueForRating', userId],
    queryFn: async () => {
      if (!userId) return [];
      return getRentalsDueForRating(userId, supabase);
    },
    enabled: !!userId,
  });

  // Fetch all active rentals to determine which ones are already rated
  const { data: activeRentals, isLoading: isLoadingActive } = useQuery({
    queryKey: ['activeRentals', userId],
    queryFn: async () => {
      if (!userId) return [];
      return getActiveRentals(userId, supabase);
    },
    enabled: !!userId,
  });

  // Fetch existing ratings to determine which rentals are rated
  const { data: userRatings } = useQuery({
    queryKey: ['userRatings', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from('ratings').select('*').eq('rater_id', userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['rentalsDueForRating', userId] });
    await queryClient.refetchQueries({ queryKey: ['activeRentals', userId] });
    await queryClient.refetchQueries({ queryKey: ['userRatings', userId] });
    setRefreshing(false);
  };

  // Combine all rentals and remove duplicates, then sort by date
  const allRentals = [...(rentalsDueForRating || []), ...(activeRentals || [])]
    .filter((rental, index, arr) => arr.findIndex((r) => r.id === rental.id) === index)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.rental_start_date || '');
      const dateB = new Date(b.rental_start_date || '');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });

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
  const renderStars = (score: number) => {
    return (
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= score ? 'star' : 'star-outline'}
            size={16}
            color={star <= score ? '#FFB800' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const getRentalCard = (rental: any) => {
    // Check if this rental has been rated
    const rating = (userRatings || []).find((r: any) => r.post_id === rental.post.id);
    const showRateButton = !rating;

    return (
      <TouchableOpacity
        key={rental.id}
        onPress={() => {
          router.push({
            pathname: `/(protected)/ratings/[id]`,
            params: { id: rental.id },
          });
        }}
        className="mb-3 rounded-lg border p-4"
        style={{ borderColor: colors.border, backgroundColor: colors.card }}>
        {/* Property Title */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="flex-1 text-lg font-bold" style={{ color: colors.foreground }}>
            {(rental as any).post?.title || 'Property'}
          </Text>
          {showRateButton && (
            <View className="ml-2 rounded-full bg-yellow-400 px-2 py-1">
              <Text className="text-xs font-bold text-gray-800">Rate Now</Text>
            </View>
          )}
        </View>

        {/* Rental Dates */}
        <Text className="mb-1 text-sm text-gray-500">
          📅 {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
        </Text>

        {/* Price */}
        {rental.monthly_rent_amount && (
          <Text className="mb-2 text-sm font-semibold" style={{ color: colors.foreground }}>
            ₱{rental.monthly_rent_amount.toLocaleString()} / month
          </Text>
        )}

        {/* Star Rating */}
        <View className="mb-2 flex-row items-center gap-2">
          {rating ? (
            <>
              {renderStars(rating.score)}
              <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
                {rating.score}.0
              </Text>
            </>
          ) : (
            <>
              <Text className="text-sm text-gray-400">Not Rated</Text>
            </>
          )}
        </View>

        {/* Status Badge */}
        <View className="flex-row items-center gap-2">
          {showRateButton ? (
            <>
              <Ionicons name="alert-circle" size={16} color="#FFB800" />
              <Text className="text-xs font-semibold text-yellow-600">Pending Review</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text className="text-xs font-semibold text-green-600">Already Rated</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const isLoading = isLoadingDue || isLoadingActive;

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color={colors.primary} />
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
        <View className="mb-6 mt-4">
          <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>
            🏠 Your Stays
          </Text>
          <Text className="mt-1 text-sm text-gray-500">Rate your rental experiences</Text>
        </View>

        {/* All Rentals */}
        <View>
          {allRentals.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons name="home-outline" size={48} color={colors.foreground} />
              <Text className="mt-4 text-center text-gray-500">No stays yet</Text>
              <Text className="text-center text-sm text-gray-400">
                Your rental history will appear here
              </Text>
            </View>
          ) : (
            allRentals.map((rental) => getRentalCard(rental))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
