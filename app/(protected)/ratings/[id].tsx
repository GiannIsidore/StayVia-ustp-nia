import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

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

  // Set initial values when existing rating loads
  React.useEffect(() => {
    if (existingRating) {
      setScore(existingRating.score);
      setComment(existingRating.comment || '');
    }
  }, [existingRating]);

  // Generate payment dates based on rental period
  const paymentDates = React.useMemo(() => {
    if (!rental?.rental_start_date || !rental?.rental_end_date || !rental?.monthly_rent_amount) {
      return [];
    }

    const dates: Array<{
      date: Date;
      amount: number;
      isPast: boolean;
    }> = [];

    const startDate = new Date(rental.rental_start_date);
    const endDate = new Date(rental.rental_end_date);
    const today = new Date();
    const paymentDay = rental.payment_day_of_month || startDate.getDate();
    const amount = rental.monthly_rent_amount;

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), paymentDay);

      if (paymentDate >= startDate && paymentDate <= endDate) {
        dates.push({
          date: paymentDate,
          amount,
          isPast: paymentDate < today,
        });
      }

      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    return dates;
  }, [rental]);

  // Create or update rating mutation
  const ratingMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !rental?.posts?.post_user?.id || !rental?.post_id) {
        throw new Error('Missing required data');
      }

      if (score === 0) {
        throw new Error('Please select a rating');
      }

      if (existingRating?.id) {
        return ratingService.updateRating(existingRating.id, supabase, score, comment);
      } else {
        return ratingService.createRating(
          userId,
          rental.posts.post_user.id,
          score,
          supabase,
          rental.post_id,
          comment
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rating', userId, id, rental?.post_id] });
      queryClient.invalidateQueries({ queryKey: ['rentalsDueForRating', userId] });
      queryClient.invalidateQueries({ queryKey: ['userRatings', userId] });

      notificationService.clearAllNotifications();

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
    onError: (error: any) => {
      console.error('Failed to save rating:', error);
      alert(error.message || 'Failed to save rating. Please try again.');
    },
  });

  const formatDate = (dateString: string) => {
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

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
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
          <Text className="mt-4 text-center text-lg font-semibold" style={{ color: colors.foreground }}>
            Rental not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const nextPayment = paymentDates.find((p) => !p.isPast);
  const totalPaid = paymentDates.filter((p) => p.isPast).length * rental.monthly_rent_amount;
  const totalDue = paymentDates.length * rental.monthly_rent_amount;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b px-4 py-3"
        style={{ borderColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
          {existingRating ? 'Edit Rating' : 'Rate Your Stay'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Property Header Card */}
        <View className="border-b px-4 py-6" style={{ borderColor: colors.border }}>
          <View className="mb-3 flex-row items-center gap-2">
            <Ionicons name="home" size={24} color={colors.primary} />
            <Text className="flex-1 text-xl font-bold" style={{ color: colors.foreground }}>
              {rental.posts.title}
            </Text>
          </View>
          
          <View className="mb-2 flex-row items-center gap-2">
            <Ionicons name="person" size={16} color={colors.foreground} />
            <Text className="text-sm" style={{ color: colors.foreground }}>
              Hosted by {rental.posts.post_user?.firstname} {rental.posts.post_user?.lastname}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar" size={16} color={colors.foreground} />
            <Text className="text-sm" style={{ color: colors.foreground }}>
              {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
            </Text>
          </View>
        </View>

        {/* Payment Overview Section */}
        <View className="border-b px-4 py-6" style={{ borderColor: colors.border }}>
          <Text className="mb-4 text-lg font-bold" style={{ color: colors.foreground }}>
            💳 Payment Summary
          </Text>

          {/* Quick Stats */}
          <View className="mb-4 flex-row gap-3">
            <View
              className="flex-1 rounded-lg border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.card }}>
              <Text className="mb-1 text-xs text-gray-500">Monthly Rent</Text>
              <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                ₱{rental.monthly_rent_amount.toLocaleString()}
              </Text>
            </View>

            <View
              className="flex-1 rounded-lg border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.card }}>
              <Text className="mb-1 text-xs text-gray-500">Total Paid</Text>
              <Text className="text-lg font-bold text-green-600">
                ₱{totalPaid.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Next Payment Alert */}
          {nextPayment && (
            <View
              className="mb-4 rounded-lg border-l-4 bg-blue-50 p-4 dark:bg-blue-950"
              style={{ borderLeftColor: '#2563EB' }}>
              <View className="mb-2 flex-row items-center gap-2">
                <Ionicons name="time" size={20} color="#2563EB" />
                <Text className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Next Payment Due
                </Text>
              </View>
              <Text className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatDateShort(nextPayment.date)}
              </Text>
              <Text className="mt-1 text-lg font-semibold text-blue-900 dark:text-blue-100">
                ₱{nextPayment.amount.toLocaleString()}
              </Text>
            </View>
          )}

          {/* Payment Schedule */}
          <View
            className="rounded-lg border p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <Text className="mb-3 font-semibold" style={{ color: colors.foreground }}>
              Payment Schedule
            </Text>
            <View className="gap-2">
              {paymentDates.map((payment, index) => (
                <View
                  key={index}
                  className="flex-row items-center justify-between rounded-lg border p-3"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: payment.isPast ? '#F0FDF4' : colors.background,
                    opacity: payment.isPast ? 0.8 : 1,
                  }}>
                  <View className="flex-1 flex-row items-center gap-2">
                    <Ionicons
                      name={payment.isPast ? 'checkmark-circle' : 'calendar-outline'}
                      size={20}
                      color={payment.isPast ? '#10B981' : colors.foreground}
                    />
                    <View>
                      <Text
                        className="font-medium"
                        style={{ color: payment.isPast ? '#059669' : colors.foreground }}>
                        {formatDateShort(payment.date)}
                      </Text>
                      {payment.isPast && (
                        <Text className="text-xs text-green-600">Paid</Text>
                      )}
                    </View>
                  </View>
                  <Text
                    className="font-bold"
                    style={{ color: payment.isPast ? '#059669' : colors.foreground }}>
                    ₱{payment.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Rating Section */}
        <View className="px-4 py-6">
          <Text className="mb-2 text-lg font-bold" style={{ color: colors.foreground }}>
            ⭐ {existingRating ? 'Your Rating' : 'Rate Your Experience'}
          </Text>
          <Text className="mb-6 text-sm text-gray-500">
            {existingRating
              ? 'You can update your rating and review'
              : 'Help others by sharing your experience with this property'}
          </Text>

          {/* Star Rating */}
          <View className="mb-6">
            <Text className="mb-3 font-semibold" style={{ color: colors.foreground }}>
              Overall Rating
            </Text>
            <View className="flex-row justify-center gap-4 rounded-lg border p-6"
              style={{ borderColor: colors.border, backgroundColor: colors.card }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setScore(star)} className="p-1">
                  <Ionicons
                    name={star <= score ? 'star' : 'star-outline'}
                    size={44}
                    color={star <= score ? '#FFB800' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {score > 0 && (
              <Text className="mt-3 text-center text-sm font-medium" style={{ color: colors.foreground }}>
                {score === 1 && '⚠️ Poor - Would not recommend'}
                {score === 2 && '😐 Fair - Needs improvement'}
                {score === 3 && '😊 Good - Satisfied with stay'}
                {score === 4 && '😄 Very Good - Would recommend'}
                {score === 5 && '🌟 Excellent - Outstanding experience!'}
              </Text>
            )}
          </View>

          {/* Review Comment */}
          <View className="mb-6">
            <Text className="mb-2 font-semibold" style={{ color: colors.foreground }}>
              Your Review (Optional)
            </Text>
            <TextInput
              multiline
              numberOfLines={5}
              maxLength={500}
              placeholder="Share details about your stay... What did you like? What could be improved?"
              placeholderTextColor="#999"
              value={comment}
              onChangeText={setComment}
              style={{
                backgroundColor: colors.card,
                color: colors.foreground,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 16,
                fontSize: 15,
                minHeight: 120,
                textAlignVertical: 'top',
              }}
            />
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-xs text-gray-400">Be honest and constructive</Text>
              <Text className="text-xs text-gray-400">{comment.length}/500</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 pb-4">
            <TouchableOpacity
              disabled={ratingMutation.isPending || score === 0}
              onPress={() => ratingMutation.mutate()}
              className={`rounded-lg py-4 ${
                ratingMutation.isPending || score === 0 ? 'bg-gray-400' : 'bg-blue-600'
              }`}>
              {ratingMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text className="font-semibold text-white">
                    {existingRating ? 'Update Rating' : 'Submit Rating'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {!existingRating && (
              <TouchableOpacity
                disabled={ratingMutation.isPending}
                onPress={() => router.back()}
                className="rounded-lg border py-4"
                style={{ borderColor: colors.border }}>
                <Text className="text-center font-semibold" style={{ color: colors.foreground }}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
