import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ratingService } from '@/services/ratingService';
import { notificationService } from '@/services/notificationService';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CALENDAR_WIDTH = SCREEN_WIDTH - 32; // Account for padding

export default function RatingDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useUser();
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();

  // Refs and animated values must come before any conditional hooks
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);

  const userId = user?.id;
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  // Animated scroll handler
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

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
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
    const paymentDay = rental.payment_day_of_month || startDate.getDate();
    const amount = rental.monthly_rent_amount;

    // Always include the start date as the first payment
    const firstPayment = new Date(startDate);
    firstPayment.setHours(0, 0, 0, 0);
    dates.push({
      date: firstPayment,
      amount,
      isPast: firstPayment < today,
    });

    // Generate subsequent monthly payments
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, paymentDay);

    while (currentDate <= endDate) {
      const paymentDate = new Date(currentDate);
      paymentDate.setHours(0, 0, 0, 0);

      if (paymentDate <= endDate) {
        dates.push({
          date: paymentDate,
          amount,
          isPast: paymentDate < today,
        });
      }

      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, paymentDay);
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

  // Calendar view data - generate calendar days for ALL months from rental start to end
  const calendarData = useMemo(() => {
    if (!rental?.rental_start_date || !rental?.rental_end_date) {
      return { months: [], allPaymentDates: [] };
    }

    const startDate = new Date(rental.rental_start_date);
    const endDate = new Date(rental.rental_end_date);

    // Create a map of payment dates for quick lookup
    const paymentMap = new Map<string, Date[]>();
    paymentDates.forEach((payment) => {
      const monthKey = `${payment.date.getFullYear()}-${payment.date.getMonth()}`;
      if (!paymentMap.has(monthKey)) {
        paymentMap.set(monthKey, []);
      }
      paymentMap.get(monthKey)!.push(payment.date);
    });

    // Generate all months from start to end
    const monthsData = [];
    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (currentMonth <= lastMonth) {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const monthKey = `${year}-${month}`;

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days: (Date | null)[] = [];

      // Add empty cells for days before month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }

      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(new Date(year, month, day));
      }

      monthsData.push({
        monthName: firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        days,
        paymentDates: paymentMap.get(monthKey) || [],
      });

      // Move to next month
      currentMonth = new Date(year, month + 1, 1);
    }

    return { months: monthsData, allPaymentDates: paymentDates };
  }, [rental?.rental_start_date, rental?.rental_end_date, paymentDates]);

  // Check if a date has a payment due
  const hasPaymentDue = (date: Date | null, monthPaymentDates: Date[]) => {
    if (!date) return false;
    return monthPaymentDates.some(
      (p) =>
        p.getDate() === date.getDate() &&
        p.getMonth() === date.getMonth() &&
        p.getFullYear() === date.getFullYear()
    );
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
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
              💳 Payment Summary
            </Text>
            <TouchableOpacity
              onPress={() => setShowCalendar(!showCalendar)}
              className="flex-row items-center gap-2 rounded-lg bg-blue-600 px-4 py-2">
              <Ionicons name={showCalendar ? 'list' : 'calendar'} size={16} color="#fff" />
              <Text className="font-semibold text-white">
                {showCalendar ? 'List View' : 'Calendar View'}
              </Text>
            </TouchableOpacity>
          </View>

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

          {/* Calendar View or List View */}
          {showCalendar ? (
            /* Calendar Carousel View */
            <View>
              {/* Month Carousel */}
              <Animated.ScrollView
                ref={scrollViewRef as any}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={scrollHandler}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / CALENDAR_WIDTH);
                  setCurrentMonthIndex(index);
                }}
                scrollEventThrottle={16}
                decelerationRate="fast"
                snapToInterval={CALENDAR_WIDTH}
                contentContainerStyle={{ paddingHorizontal: 0 }}>
                {calendarData.months.map((monthData, monthIndex) => (
                  <View key={monthIndex} style={{ width: CALENDAR_WIDTH }}>
                    <View
                      className="mx-1 rounded-2xl border p-5 shadow-lg"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 5,
                      }}>
                      {/* Month Header with Navigation */}
                      <View className="mb-4 flex-row items-center justify-between">
                        <TouchableOpacity
                          onPress={() => {
                            const newIndex = monthIndex - 1;
                            if (newIndex >= 0) {
                              setCurrentMonthIndex(newIndex);
                              (scrollViewRef.current as any)?.scrollTo({
                                x: newIndex * CALENDAR_WIDTH,
                                animated: true,
                              });
                            }
                          }}
                          disabled={monthIndex === 0}
                          className="p-2"
                          style={{ opacity: monthIndex === 0 ? 0.3 : 1 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </TouchableOpacity>

                        <View className="flex-1 items-center">
                          <Text className="text-xl font-bold" style={{ color: colors.foreground }}>
                            {monthData.monthName}
                          </Text>
                          <View className="mt-2 flex-row gap-1">
                            {calendarData.months.map((_, idx) => (
                              <View
                                key={idx}
                                className="h-1.5 rounded-full"
                                style={{
                                  width: idx === currentMonthIndex ? 16 : 6,
                                  backgroundColor:
                                    idx === currentMonthIndex ? colors.primary : '#D1D5DB',
                                }}
                              />
                            ))}
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => {
                            const newIndex = monthIndex + 1;
                            if (newIndex < calendarData.months.length) {
                              setCurrentMonthIndex(newIndex);
                              (scrollViewRef.current as any)?.scrollTo({
                                x: newIndex * CALENDAR_WIDTH,
                                animated: true,
                              });
                            }
                          }}
                          disabled={monthIndex === calendarData.months.length - 1}
                          className="p-2"
                          style={{
                            opacity: monthIndex === calendarData.months.length - 1 ? 0.3 : 1,
                          }}>
                          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                        </TouchableOpacity>
                      </View>

                      {/* Day labels */}
                      <View className="mb-3 flex-row">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                          <Text
                            key={`${day}-${idx}`}
                            className="flex-1 text-center text-xs font-bold"
                            style={{ color: colors.foreground, opacity: 0.6 }}>
                            {day}
                          </Text>
                        ))}
                      </View>

                      {/* Calendar Grid */}
                      <View>
                        {Array.from({ length: Math.ceil(monthData.days.length / 7) }).map(
                          (_, weekIndex) => (
                            <View key={weekIndex} className="mb-1.5 flex-row gap-1.5">
                              {monthData.days
                                .slice(weekIndex * 7, (weekIndex + 1) * 7)
                                .map((day, dayIndex) => {
                                  const hasPayment = hasPaymentDue(day, monthData.paymentDates);
                                  const isPast = day ? day < new Date() : false;
                                  const isToday = day
                                    ? day.getDate() === new Date().getDate() &&
                                      day.getMonth() === new Date().getMonth() &&
                                      day.getFullYear() === new Date().getFullYear()
                                    : false;

                                  return (
                                    <View
                                      key={dayIndex}
                                      className="aspect-square flex-1 items-center justify-center rounded-xl"
                                      style={{
                                        backgroundColor: hasPayment
                                          ? isPast
                                            ? '#10B981'
                                            : '#DC2626'
                                          : isToday
                                            ? colors.primary + '20'
                                            : 'transparent',
                                        borderWidth: isToday && !hasPayment ? 2 : 0,
                                        borderColor: colors.primary,
                                      }}>
                                      {day ? (
                                        <>
                                          <Text
                                            className="text-sm font-bold"
                                            style={{
                                              color: hasPayment ? '#fff' : colors.foreground,
                                            }}>
                                            {day.getDate()}
                                          </Text>
                                          {hasPayment && (
                                            <View className="absolute -bottom-1">
                                              <View className="h-1.5 w-1.5 rounded-full bg-white" />
                                            </View>
                                          )}
                                        </>
                                      ) : null}
                                    </View>
                                  );
                                })}
                            </View>
                          )
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </Animated.ScrollView>

              {/* Legend */}
              <View className="mt-4 flex-row items-center justify-center gap-6">
                <View className="flex-row items-center gap-2">
                  <View className="h-3 w-3 rounded-full bg-red-600" />
                  <Text className="text-xs font-medium" style={{ color: colors.foreground }}>
                    Upcoming
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="h-3 w-3 rounded-full bg-green-600" />
                  <Text className="text-xs font-medium" style={{ color: colors.foreground }}>
                    Paid
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View
                    className="h-3 w-3 rounded-full border-2"
                    style={{ borderColor: colors.primary }}
                  />
                  <Text className="text-xs font-medium" style={{ color: colors.foreground }}>
                    Today
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* List View - Payment Schedule */
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
                        {payment.isPast && <Text className="text-xs text-green-600">Paid</Text>}
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
          )}
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
            <View
              className="flex-row justify-center gap-4 rounded-lg border p-6"
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
              <Text
                className="mt-3 text-center text-sm font-medium"
                style={{ color: colors.foreground }}>
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
