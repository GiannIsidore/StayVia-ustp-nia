import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RatingForm } from '@/components/RatingForm';
import { PaymentCalendar } from '@/components/PaymentCalendar';
import { ratingService } from '@/services/ratingService';
import { notificationService } from '@/services/notificationService';

export default function RatingDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useUser();
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();

  const userId = user?.id;
  const [showingForm, setShowingForm] = useState(true);

  // Fetch rental details with post and user information
  const { data: rental, isLoading: isLoadingRental } = useQuery({
    queryKey: ['rental', id],
    queryFn: async () => {
      if (!id || !userId) return null;

      const { data, error } = await supabase
        .from('requests')
        .select(
          `
          *,
          posts(id, title, description, latitude, longitude, price_per_night, user_id, post_user:users(id, firstname, lastname, avatar, account_type))
        `
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!id && !!userId,
  });

  // Fetch existing rating if user has already rated
  const { data: existingRating, isLoading: isLoadingRating } = useQuery({
    queryKey: ['rating', userId, id, rental?.post_id],
    queryFn: async () => {
      if (!userId || !rental?.post_id) return null;

      try {
        const rating = await ratingService.getRatingBetweenUsers(
          userId,
          rental?.posts?.post_user?.id,
          supabase,
          rental?.post_id
        );
        return rating;
      } catch (error) {
        console.error('Error fetching rating:', error);
        return null;
      }
    },
    enabled: !!userId && !!rental?.post_id && !!rental?.posts?.post_user?.id,
  });

  // Generate payment dates based on rental period
  const paymentDates = React.useMemo(() => {
    if (!rental?.rental_start_date || !rental?.rental_end_date || !rental?.monthly_rent_amount) {
      return [];
    }

    const dates: Array<{
      date: Date;
      amount: number;
      rentalId: string;
      propertyTitle: string;
    }> = [];

    const startDate = new Date(rental.rental_start_date);
    const endDate = new Date(rental.rental_end_date);
    const paymentDay = rental.payment_day_of_month || startDate.getDate();
    const amount = rental.monthly_rent_amount;
    const propertyTitle = rental.posts?.title || 'Property';
    const rentalId = rental.id;

    // Generate payment dates for each month between start and end
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), paymentDay);

      if (paymentDate >= startDate && paymentDate <= endDate) {
        dates.push({
          date: paymentDate,
          amount,
          rentalId,
          propertyTitle,
        });
      }

      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    return dates;
  }, [rental]);

  // Create or update rating mutation
  const ratingMutation = useMutation({
    mutationFn: async (payload: { score: number; comment: string }) => {
      if (!userId || !rental?.posts?.post_user?.id || !rental?.post_id) {
        throw new Error('Missing required data');
      }

      if (existingRating?.id) {
        // Update existing rating
        return ratingService.updateRating(
          existingRating.id,
          supabase,
          payload.score,
          payload.comment
        );
      } else {
        // Create new rating
        return ratingService.createRating(
          userId,
          rental.posts.post_user.id,
          payload.score,
          supabase,
          rental.post_id,
          payload.comment
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rating', userId, id, rental?.post_id] });
      queryClient.invalidateQueries({ queryKey: ['rentalsDueForRating', userId] });
      queryClient.invalidateQueries({ queryKey: ['userRatings', userId] });

      // Clear all notifications
      notificationService.clearAllNotifications();

      // Mark notification as sent if it wasn't already
      if (rental?.id) {
        supabase
          .from('requests')
          .update({ rating_notif_sent: true, rating_notif_sent_at: new Date().toISOString() })
          .eq('id', rental.id)
          .then(() => {
            router.back();
          });
      }
    },
    onError: (error) => {
      console.error('Failed to save rating:', error);
      alert('Failed to save rating. Please try again.');
    },
  });

  const handleSkip = () => {
    router.back();
  };

  const isLoading = isLoadingRental || isLoadingRating;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!rental || !rental.posts) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center">
          <Ionicons name="alert-circle" size={48} color={colors.foreground} />
          <Text
            className="mt-4 text-center text-lg font-semibold"
            style={{ color: colors.foreground }}>
            Rental not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View
        className="flex-row items-center justify-between border-b px-4 py-3"
        style={{ borderColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
          Rate Your Stay
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Tab-like toggle between form and calendar */}
        <View className="my-4 flex-row gap-2">
          <TouchableOpacity
            onPress={() => setShowingForm(true)}
            className={`flex-1 rounded-lg py-3 ${showingForm ? 'bg-blue-600' : 'border'}`}
            style={
              !showingForm
                ? { borderColor: colors.border, backgroundColor: colors.card }
                : undefined
            }>
            <Text
              className="text-center font-semibold"
              style={{ color: showingForm ? '#fff' : colors.foreground }}>
              Rating
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowingForm(false)}
            className={`flex-1 rounded-lg py-3 ${!showingForm ? 'bg-blue-600' : 'border'}`}
            style={
              showingForm ? { borderColor: colors.border, backgroundColor: colors.card } : undefined
            }>
            <Text
              className="text-center font-semibold"
              style={{ color: !showingForm ? '#fff' : colors.foreground }}>
              Payment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rating Form or Payment Calendar */}
        {showingForm ? (
          <RatingForm
            propertyTitle={rental.posts.title}
            hostName={`${rental.posts.post_user?.firstname || ''} ${rental.posts.post_user?.lastname || ''}`.trim()}
            rentalDates={{
              startDate: rental.rental_start_date || '',
              endDate: rental.rental_end_date || '',
            }}
            initialRating={
              existingRating
                ? {
                    score: existingRating.score,
                    comment: existingRating.comment || '',
                  }
                : undefined
            }
            isEditing={!!existingRating}
            onSubmit={async (score, comment) => {
              await ratingMutation.mutateAsync({ score, comment });
            }}
            onSkip={handleSkip}
            isLoading={ratingMutation.isPending}
          />
        ) : (
          <PaymentCalendar paymentDates={paymentDates} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
