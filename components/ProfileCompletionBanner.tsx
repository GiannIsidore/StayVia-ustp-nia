import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { User } from '@/services/userService';

interface ProfileCompletionBannerProps {
  user: User;
}

export function ProfileCompletionBanner({ user }: ProfileCompletionBannerProps) {
  const router = useRouter();

  // Only show for students
  if (user.account_type !== 'student') {
    return null;
  }

  // Check if profile is incomplete
  const isIncomplete =
    !user.date_of_birth || !user.gender || !user.home_address || !user.city || !user.province;

  if (!isIncomplete) {
    return null;
  }

  // Calculate completion percentage
  const totalFields = 13; // Total new student fields
  let completedFields = 0;

  if (user.date_of_birth) completedFields++;
  if (user.gender) completedFields++;
  if (user.religion) completedFields++;
  if (user.nationality) completedFields++;
  if (user.home_address) completedFields++;
  if (user.city) completedFields++;
  if (user.province) completedFields++;
  if (user.postal_code) completedFields++;
  if (user.parent_name) completedFields++;
  if (user.parent_contact) completedFields++;
  if (user.parent_email) completedFields++;
  if (user.emergency_contact_name) completedFields++;
  if (user.emergency_contact_number) completedFields++;

  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  return (
    <TouchableOpacity
      onPress={() => router.push('/(profile)/editProfile')}
      className="mx-4 my-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <View className="flex-row items-start">
        <View className="mr-3 mt-1">
          <Ionicons name="information-circle" size={24} color="#2563EB" />
        </View>

        <View className="flex-1">
          <Text className="mb-1 text-base font-semibold text-blue-900 dark:text-blue-100">
            Complete Your Profile
          </Text>
          <Text className="mb-2 text-sm text-blue-700 dark:text-blue-300">
            Your profile is {completionPercentage}% complete. Add more information to help landlords
            know you better.
          </Text>

          {/* Progress Bar */}
          <View className="mb-2 h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
            <View className="h-full bg-blue-600" style={{ width: `${completionPercentage}%` }} />
          </View>

          <View className="flex-row items-center">
            <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Update Profile
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#2563EB" style={{ marginLeft: 4 }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
