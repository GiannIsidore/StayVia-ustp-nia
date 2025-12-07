import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import FeatherIcon from '@expo/vector-icons/Feather';
import { useUser, useAuth } from '@clerk/clerk-expo';
import * as Location from 'expo-location';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserById } from '@/services/userService';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/supabase';
import DownloadImage from '@/components/download/downloadImage';
import { Ionicons } from '@expo/vector-icons';
import { fetchPostsByUserId } from '@/services/postService';
import { useAccountType } from '@/hooks/useAccountType';

export default function Account() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const supabase = useSupabase();

  const [locationLabel, setLocationLabel] = useState('Turn on location');
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);

  const [form, setForm] = useState({
    emailNotifications: true,
    pushNotifications: false,
  });

  const id = user?.id;
  const { data, error, isLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserById(id as string, supabase),
    enabled: !!id,
  });

  const { isLandlord } = useAccountType();

  // Get user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLabel('Permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      const label = [place.name, place.street, place.city, place.region, place.country]
        .filter(Boolean)
        .join(', ');
      setLocationLabel(label || 'Unknown location');
    })();
  }, []);

  const defaultAvatar = 'https://i.pravatar.cc/150';
  const avatarUrl =
    !user?.imageUrl || user.imageUrl.includes('clerk.dev/static') ? defaultAvatar : user.imageUrl;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="text-gray-900 dark:text-white">Loading...</Text>
      </SafeAreaView>
    );
  }

  const resources = [
    { key: 'settings', label: 'Account Settings', route: '../../(profile)/settings' },
    { key: 'location', label: 'Location', route: null },
    { key: 'about', label: 'About Us', route: '../../(profile)/about' },
  ];

  const truncate = (str: string, max: number) =>
    str.length > max ? str.substring(0, max) + '...' : str;

  const { data: postData, error: postError } = useQuery({
    queryKey: ['posts', user?.id],
    queryFn: () => fetchPostsByUserId(user?.id as string, supabase),
    // enabled: !user?.id
  });

  // console.log(JSON.stringify(postData, null, 2))

  const handleUserPosts = () => {
    if (!postData || postData.length === 0) {
      Alert.alert('No Posts', "You don't have any posts yet.");
      return;
    }

    if (postData[0]?.post_user?.id) {
      router.push(`/(user)/${postData[0].post_user.id}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100 dark:bg-black" edges={['top']}>
      <ScrollView className="px-4 pb-8">
        {/* Account Card */}
        <View className="py-6">
          <Text className="mb-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
            Account
          </Text>
          <TouchableOpacity
            onPress={() => router.push(`../../(profile)/editProfile`)}
            className="flex-row items-center justify-between rounded-3xl bg-white px-5 py-6 shadow-md dark:bg-neutral-900">
            <View className="flex-row items-center">
              <DownloadImage
                path={data?.avatar}
                supabase={supabase}
                fallbackUri={avatarUrl}
                className="mr-4 h-16 w-16 rounded-full"
              />
              <View>
                <View className="flex-row items-center">
                  <Text className="text-lg font-semibold text-gray-800 dark:text-white">
                    {data?.username ? data.username : `${data?.firstname} ${data?.lastname}`}
                  </Text>
                  {data?.account_type === 'landlord' && (
                    <Ionicons name="checkmark-circle" size={16} color="#3B82F6" className="ml-2" />
                  )}
                </View>
                <Text className="text-sm text-gray-500 dark:text-gray-400">{data?.email}</Text>
              </View>
            </View>
            <FeatherIcon name="chevron-right" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {isLandlord && (
          <View className="py-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
              POSTS
            </Text>
            <View className="rounded-2xl bg-white shadow-md dark:bg-neutral-900">
              <TouchableOpacity
                onPress={handleUserPosts}
                className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <Text className="text-base text-gray-800 dark:text-white">My Posts</Text>
                <FeatherIcon name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Resources */}
        <View className="py-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
            Resources
          </Text>
          <View className="rounded-2xl bg-white shadow-md dark:bg-neutral-900">
            {resources.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                onPress={() => {
                  if (item.key === 'location') setLocationModalVisible(true);
                  else if (item.route) router.push(item.route as never);
                }}
                className={`flex-row items-center px-5 py-4 ${
                  idx !== resources.length - 1
                    ? 'border-b border-gray-100 dark:border-gray-800'
                    : ''
                }`}>
                <Text className="text-base text-gray-800 dark:text-white">{item.label}</Text>
                <View className="flex-1" />
                {item.key === 'location' && (
                  <Text className="mr-2 text-sm text-gray-500 dark:text-gray-400">
                    {truncate(locationLabel, 25)}
                  </Text>
                )}
                <FeatherIcon name="chevron-right" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location Modal */}
        <Modal
          visible={isLocationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLocationModalVisible(false)}>
          <View className="flex-1 items-center justify-center bg-black/50">
            <View className="w-11/12 max-w-md rounded-2xl bg-white p-6 shadow-lg dark:bg-neutral-900">
              <Text className="mb-2 text-center text-base font-semibold dark:text-white">
                Your Location
              </Text>
              <Text className="text-center text-sm text-gray-700 dark:text-gray-300">
                {locationLabel}
              </Text>
              <Pressable
                onPress={() => setLocationModalVisible(false)}
                className="mt-6 rounded-lg bg-blue-600 px-4 py-2">
                <Text className="text-center font-medium text-white">Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Logout */}
        <View className="py-4">
          <View className="rounded-2xl bg-white shadow-md dark:bg-neutral-900">
            {/* <TouchableOpacity
              onPress={() => signOut()}
              className="flex-row items-center justify-center px-5 py-4"
            >
              <Text className="text-red-600 font-semibold text-base">Logout</Text>
            </TouchableOpacity> */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  await signOut();
                  setTimeout(() => {
                    router.replace('/(auth)/sign-in');
                  }, 100);
                } catch (err) {
                  console.error('Sign out error:', err);
                  Alert.alert('Error', 'Something went wrong signing out.');
                }
              }}
              className="flex-row items-center justify-center px-5 py-4">
              <Text className="text-base font-semibold text-red-600">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
