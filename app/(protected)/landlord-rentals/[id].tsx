import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { updateRentalDates } from '@/services/requestService';

export default function LandlordRentalDetailPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useUser();
  const router = useRouter();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editEndDate, setEditEndDate] = useState<string>('');
  const [editMonthlyAmount, setEditMonthlyAmount] = useState<string>('');
  const [editPaymentDay, setEditPaymentDay] = useState<string>('');

  // Fetch rental details
  const {
    data: rental,
    isLoading: isLoadingRental,
    error: rentalError,
  } = useQuery({
    queryKey: ['rentalDetail', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('requests')
        .select(
          `
          *,
          users:user_id(id, firstname, lastname, avatar, email),
          posts:post_id(id, title, description, location, price_per_night, image)
        `
        )
        .eq('id', id)
        .single();

      console.log('Rental fetch result:', { data, error });

      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // Fetch rating for this tenant
  const { data: tenantRating } = useQuery({
    queryKey: ['tenantRating', user?.id, rental?.user_id],
    queryFn: async () => {
      if (!user?.id || !rental?.user_id) return null;

      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('rater_id', user.id)
        .eq('ratee_id', rental?.user_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!user?.id && !!rental?.user_id,
  });

  // Update rental dates mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Rental ID missing');

      return updateRentalDates(
        id,
        new Date(editStartDate),
        new Date(editEndDate),
        parseInt(editPaymentDay) || rental?.payment_day_of_month || 1,
        parseFloat(editMonthlyAmount) || rental?.monthly_rent_amount || 0,
        supabase
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentalDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['approvedRequests'] });
      setIsEditing(false);
      Alert.alert('Success', 'Rental details updated');
    },
    onError: (error) => {
      console.error('Error updating rental:', error);
      Alert.alert('Error', 'Failed to update rental details');
    },
  });

  const handleEditStart = () => {
    setEditStartDate(rental?.rental_start_date || '');
    setEditEndDate(rental?.rental_end_date || '');
    setEditMonthlyAmount(rental?.monthly_rent_amount?.toString() || '');
    setEditPaymentDay(rental?.payment_day_of_month?.toString() || '1');
    setIsEditing(true);
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

  const isLoading = isLoadingRental;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!rental) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-black">
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="alert-circle" size={48} color={colors.foreground} />
          <Text
            className="mt-4 text-center text-lg font-semibold"
            style={{ color: colors.foreground }}>
            Rental not found
          </Text>
          {rentalError && (
            <Text className="mt-2 text-center text-sm text-gray-500">
              {(rentalError as any)?.message}
            </Text>
          )}
          <Text className="mt-2 text-center text-xs text-gray-400">ID: {id}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3">
            <Text className="font-semibold text-white">Go Back</Text>
          </TouchableOpacity>
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
          Rental Details
        </Text>
        <TouchableOpacity onPress={handleEditStart} className="p-2">
          <Ionicons name="create-outline" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {/* Tenant Info Card */}
        <View
          className="mb-6 rounded-lg border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <Text className="mb-3 text-lg font-bold" style={{ color: colors.foreground }}>
            👤 Tenant Information
          </Text>

          <View className="mb-3">
            <Text className="text-sm text-gray-500">Name</Text>
            <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
              {rental.users?.firstname} {rental.users?.lastname}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-sm text-gray-500">Email</Text>
            <Text className="text-base" style={{ color: colors.foreground }}>
              {rental.users?.email}
            </Text>
          </View>

          {/* Tenant Rating */}
          {tenantRating && (
            <View className="mt-3 border-t pt-3" style={{ borderColor: colors.border }}>
              <Text className="mb-2 text-sm text-gray-500">Your Rating</Text>
              <View className="flex-row items-center gap-2">
                <View className="flex-row">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= tenantRating.score ? 'star' : 'star-outline'}
                      size={18}
                      color="#FFB800"
                    />
                  ))}
                </View>
                <Text className="font-semibold" style={{ color: colors.foreground }}>
                  {tenantRating.score}.0
                </Text>
              </View>
              {tenantRating.comment && (
                <Text className="mt-2 text-sm italic text-gray-600">"{tenantRating.comment}"</Text>
              )}
            </View>
          )}
        </View>

        {/* Property Info Card */}
        <View
          className="mb-6 rounded-lg border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <Text className="mb-3 text-lg font-bold" style={{ color: colors.foreground }}>
            🏘️ Property Information
          </Text>

          <View className="mb-3">
            <Text className="text-sm text-gray-500">Property</Text>
            <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
              {rental.posts?.title}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-sm text-gray-500">Location</Text>
            <Text className="text-base" style={{ color: colors.foreground }}>
              {rental.posts?.location}
            </Text>
          </View>

          {rental.posts?.description && (
            <View>
              <Text className="text-sm text-gray-500">Description</Text>
              <Text className="text-sm" style={{ color: colors.foreground }}>
                {rental.posts.description}
              </Text>
            </View>
          )}
        </View>

        {/* Rental Details Card */}
        {isEditing ? (
          <View
            className="mb-6 rounded-lg border p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <Text className="mb-4 text-lg font-bold" style={{ color: colors.foreground }}>
              ✏️ Edit Rental Details
            </Text>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-semibold" style={{ color: colors.foreground }}>
                Start Date (YYYY-MM-DD)
              </Text>
              <TextInput
                value={editStartDate}
                onChangeText={setEditStartDate}
                placeholder="2024-01-01"
                placeholderTextColor="#999"
                style={{
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  fontFamily: 'System',
                }}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-semibold" style={{ color: colors.foreground }}>
                End Date (YYYY-MM-DD)
              </Text>
              <TextInput
                value={editEndDate}
                onChangeText={setEditEndDate}
                placeholder="2024-12-31"
                placeholderTextColor="#999"
                style={{
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  fontFamily: 'System',
                }}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-semibold" style={{ color: colors.foreground }}>
                Monthly Amount (₱)
              </Text>
              <TextInput
                value={editMonthlyAmount}
                onChangeText={setEditMonthlyAmount}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  fontFamily: 'System',
                }}
              />
            </View>

            <View className="mb-6">
              <Text className="mb-2 text-sm font-semibold" style={{ color: colors.foreground }}>
                Payment Day of Month
              </Text>
              <TextInput
                value={editPaymentDay}
                onChangeText={setEditPaymentDay}
                placeholder="1"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={2}
                style={{
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  fontFamily: 'System',
                }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                className="flex-1 rounded-lg border py-3"
                style={{ borderColor: colors.border }}>
                <Text className="text-center font-semibold" style={{ color: colors.foreground }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className={`flex-1 rounded-lg py-3 ${
                  updateMutation.isPending ? 'bg-gray-400' : 'bg-blue-600'
                }`}>
                <Text className="text-center font-semibold text-white">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            className="mb-6 rounded-lg border p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.card }}>
            <Text className="mb-3 text-lg font-bold" style={{ color: colors.foreground }}>
              📋 Rental Details
            </Text>

            <View className="mb-3">
              <Text className="text-sm text-gray-500">Start Date</Text>
              <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                {formatDate(rental.rental_start_date)}
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-sm text-gray-500">End Date</Text>
              <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                {formatDate(rental.rental_end_date)}
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-sm text-gray-500">Duration</Text>
              <Text className="text-base" style={{ color: colors.foreground }}>
                {rental.rental_start_date && rental.rental_end_date
                  ? Math.ceil(
                      (new Date(rental.rental_end_date).getTime() -
                        new Date(rental.rental_start_date).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 'N/A'}{' '}
                days
              </Text>
            </View>

            <View className="mb-3">
              <Text className="text-sm text-gray-500">Monthly Rent</Text>
              <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                ₱{rental.monthly_rent_amount?.toLocaleString() || '0'}
              </Text>
            </View>

            <View>
              <Text className="text-sm text-gray-500">Payment Day</Text>
              <Text className="text-base" style={{ color: colors.foreground }}>
                {rental.payment_day_of_month
                  ? `Day ${rental.payment_day_of_month} of month`
                  : 'Not set'}
              </Text>
            </View>
          </View>
        )}

        {/* Rental Status */}
        <View
          className="mb-6 rounded-lg border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <Text className="mb-3 text-lg font-bold" style={{ color: colors.foreground }}>
            📊 Status
          </Text>

          <View className="mb-2 flex-row items-center gap-2">
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={{ color: colors.foreground }}>
              <Text className="font-semibold">Confirmed:</Text> {rental.confirmed ? 'Yes' : 'No'}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={20} color={colors.foreground} />
            <Text style={{ color: colors.foreground }}>
              <Text className="font-semibold">Requested on:</Text> {formatDate(rental.created_at)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
