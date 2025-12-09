import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

import { fetchPostsById, fetchPostsRequests } from '@/services/postService';
import { useSupabase } from '@/lib/supabase';
import DownloadImage from '@/components/download/downloadImage';
import DownloadPostImages from '@/components/download/downloadPostImages';
import { useUser } from '@clerk/clerk-expo';
import { insertRequestByUserId } from '@/services/requestService';
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { fetchNearbyLandmarks as fetchLandmarksFromAPI } from '@/services/mapService';
import { RatingsDisplay } from '@/components/RatingsDisplay';
import { ratingService } from '@/services/ratingService';
import { getOrCreateConversation } from '@/services/conversationService';

import { useAppTheme } from '@/lib/theme';
import MapViewWithLandmarks from '@/components/MapViewWithLandmarks';

export default function DetailPost() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const supabase = useSupabase();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const userId = user?.id;
  const defaultAvatar = 'https://i.pravatar.cc/150';

  // Radius state for landmarks (optimized to 500m default, max 750m)
  // 🗺️ No category state - using Google Maps prominence ranking!
  const [landmarkRadius, setLandmarkRadius] = useState(500);

  // Fetch post details
  const {
    data: post,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['posts', id],
    queryFn: () => fetchPostsById(id as string, supabase),
    enabled: !!id,
  });

  // Fetch nearby landmarks using Google Places API (prominence ranking)
  const { data: nearbyLandmarks, isLoading: isLoadingLandmarks } = useQuery({
    queryKey: ['landmarks', post?.latitude, post?.longitude, landmarkRadius],
    queryFn: async () => {
      if (!post?.latitude || !post?.longitude) return [];
      return fetchLandmarksFromAPI({
        latitude: post.latitude,
        longitude: post.longitude,
        radius: landmarkRadius,
        // 🗺️ No category filter - using Google Maps prominence ranking!
      });
    },
    enabled: !!post?.latitude && !!post?.longitude,
  });

  // Fetch all requests for this post
  const { data: postRequests, isLoading: isCheckingRequest } = useQuery({
    queryKey: ['request', id],
    queryFn: () => fetchPostsRequests(id as string, supabase),
    enabled: !!id,
  });

  // Fetch ratings for this post
  const { data: postRatings } = useQuery({
    queryKey: ['postRatings', id],
    queryFn: async () => {
      if (!id) return [];
      const ratings = await ratingService.getPostRatings(id, supabase);
      return ratings as any[];
    },
    enabled: !!id,
  });

  const isOwnPost = userId === post?.post_user?.id;
  const isAvailable = !!post?.availability;

  // Request mutation
  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !id) throw new Error('User or post ID missing');
      return insertRequestByUserId(userId, id as string, supabase);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['request', id] }),
    onError: (err) => console.error('Failed to request post:', err),
  });

  const { mutate, isPending } = requestMutation;

  const handleRequestPost = () => {
    if (!isAvailable || isOwnPost) return;
    mutate();
  };

  // Message/Conversation mutation
  const { mutate: startConversation, isPending: isStartingConversation } = useMutation({
    mutationFn: async () => {
      if (!user?.id || !post?.post_user?.id) {
        throw new Error('User or post owner ID missing');
      }
      return getOrCreateConversation(supabase, user.id, post.post_user.id);
    },
    onSuccess: (conversation) => {
      if (!post?.post_user) return;

      const userName =
        post.post_user.firstname || post.post_user.lastname
          ? `${post.post_user.firstname ?? ''} ${post.post_user.lastname ?? ''}`.trim()
          : (post.post_user.username ?? 'Stayvia User');

      router.push(
        `/(channel)/${conversation.id}?name=${encodeURIComponent(userName)}&avatar=${encodeURIComponent(post.post_user.avatar ?? '')}`
      );
    },
    onError: (error: any) => {
      console.error('Error creating or fetching conversation:', error.message);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
    },
  });

  const handleMessagePress = () => {
    if (!user?.id || !post?.post_user?.id || isOwnPost) return;
    startConversation();
  };

  // Button label logic with multi-tenant support
  const [buttonLabel, setButtonLabel] = useState('Request Rental');
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [occupancyInfo, setOccupancyInfo] = useState<{
    current: number;
    max: number;
    available: number;
  }>({ current: 0, max: 1, available: 1 });

  useEffect(() => {
    // Ensure postRequests is an array for consistent handling
    const requestsArray = postRequests
      ? Array.isArray(postRequests)
        ? postRequests
        : [postRequests]
      : [];

    // Count confirmed tenants (only confirmed requests count toward occupancy)
    const confirmedCount = requestsArray.filter((r) => r.confirmed === true).length;
    const maxOccupancy = post?.max_occupancy || 1;
    const availableSlots = maxOccupancy - confirmedCount;

    setOccupancyInfo({
      current: confirmedCount,
      max: maxOccupancy,
      available: availableSlots,
    });

    // Find current user's request
    const myRequest = requestsArray.find((req) => req.user_id === userId);

    // Check if slots are available
    const slotsAvailable = availableSlots > 0;

    // Post marked as unavailable by landlord
    if (!isAvailable) {
      setButtonLabel('Unavailable');
      setButtonDisabled(true);
      return;
    }

    // User already has a request
    if (myRequest) {
      if (myRequest.confirmed) {
        setButtonLabel('Approved / Stays');
        setButtonDisabled(true);
      } else if (myRequest.requested) {
        setButtonLabel('Acknowledged');
        setButtonDisabled(true);
      } else {
        setButtonLabel('Pending Request');
        setButtonDisabled(true);
      }
      return;
    }

    // No slots available
    if (!slotsAvailable) {
      setButtonLabel('Fully Occupied');
      setButtonDisabled(true);
      return;
    }

    // Slots available and user hasn't requested
    setButtonLabel(
      `Request Rental (${availableSlots} slot${availableSlots !== 1 ? 's' : ''} left)`
    );
    setButtonDisabled(false);
  }, [postRequests, userId, isAvailable, post?.max_occupancy]);

  // Safe cast: only keep string filters from jsonb
  const filters: string[] = Array.isArray(post?.filters)
    ? post.filters.filter((f): f is string => typeof f === 'string')
    : [];

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white px-4 py-4 dark:bg-black">
        <Skeleton className="mb-4 h-64 w-full rounded-lg" />
        <Skeleton className="mb-2 h-6 w-1/3 rounded-full" />
        <Skeleton className="mb-2 h-4 w-1/2" />
        <Skeleton className="mb-4 h-20 w-full rounded-lg" />
        <Skeleton className="mb-4 h-60 w-full rounded-lg" />
        <Skeleton className="mb-2 h-6 w-1/3 rounded-full" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Text className="text-lg font-medium text-gray-900 dark:text-white">Post not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-2">
        {/* Image Header */}
        <View className="relative mb-4">
          {post.image ? (
            <DownloadPostImages
              path={post.image}
              supabase={supabase}
              fallbackUri={defaultAvatar}
              className="h-64 w-full rounded-xl shadow-lg"
            />
          ) : (
            <View className="flex h-64 w-full items-center justify-center rounded-xl bg-gray-200 shadow-lg">
              <Ionicons name="image-outline" size={60} color="#9CA3AF" />
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 top-6 rounded-full bg-black bg-opacity-50 p-2">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* User Info + Chat */}
        <View className="mb-4 flex-row items-center justify-between">
          {post.post_user && (
            <TouchableOpacity
              onPress={() => router.push(`/(user)/${post?.post_user?.id}`)}
              className="flex-shrink flex-row items-center">
              {post.post_user.avatar ? (
                <DownloadImage
                  path={post.post_user.avatar}
                  supabase={supabase}
                  fallbackUri={defaultAvatar}
                  style={{ width: 50, height: 50, borderRadius: 50, marginRight: 12 }}
                />
              ) : (
                <View className="mr-3 h-12 w-12 rounded-full bg-gray-300" />
              )}
              <View>
                <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                  {post.post_user.firstname || post.post_user.lastname
                    ? `${post.post_user.firstname ?? ''} ${post.post_user.lastname ?? ''}`.trim()
                    : (post.post_user.username ?? 'Stayvia User')}
                </Text>
                {post.created_at && (
                  <Text className="text-xs text-gray-500">
                    {new Date(post.created_at).toLocaleDateString()} ·{' '}
                    {new Date(post.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          {!isOwnPost && (
            <TouchableOpacity
              onPress={handleMessagePress}
              disabled={isStartingConversation}
              className={`rounded-full bg-blue-600 p-3 shadow-md ${isStartingConversation ? 'opacity-50' : ''}`}>
              {isStartingConversation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="chatbubble" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Post Details */}
        <Text className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{post.title}</Text>
        {post.location && <Text className="mb-2 text-sm text-gray-500">📍 {post.location}</Text>}

        {/* Map and Nearby Landmarks */}
        {post.latitude != null && post.longitude != null && (
          <MapViewWithLandmarks
            latitude={post.latitude}
            longitude={post.longitude}
            title={post.title}
            landmarks={nearbyLandmarks || []}
            isLoading={isLoadingLandmarks}
            colors={colors}
            radius={landmarkRadius}
            onRadiusChange={setLandmarkRadius}
          />
        )}

        {post.price_per_night && (
          <Text className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Monthly: ₱ {post.price_per_night}
          </Text>
        )}

        {/* Multi-Tenant Occupancy Info */}
        {occupancyInfo.max > 1 && (
          <View className="mb-4 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <Text className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Multi-Tenant Property
            </Text>
            <Text className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              {occupancyInfo.current} of {occupancyInfo.max} slots occupied
              {occupancyInfo.available > 0 && ` • ${occupancyInfo.available} available`}
            </Text>
          </View>
        )}

        {post.description && (
          <Text className="mb-4 text-gray-800 dark:text-gray-200">
            Post Details: {post.description}
          </Text>
        )}

        {/* Filters as badges */}
        {filters.length > 0 && (
          <>
            <Text className="mb-2 dark:text-white">Filters:</Text>
            <View className="mb-6 flex-row flex-wrap">
              {filters.map((filter, index) => (
                <Badge key={index} className="mb-2 mr-2 rounded-lg" variant="secondary">
                  <Text className="dark:text-white">{filter}</Text>
                </Badge>
              ))}
            </View>
          </>
        )}

        {/* Ratings Display */}
        {postRatings && postRatings.length > 0 && (
          <View className="mb-6">
            <RatingsDisplay ratings={postRatings} />
          </View>
        )}
      </ScrollView>

      {/* Sticky Request Button */}
      {!isOwnPost && (
        <View className="absolute bottom-0 w-full border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-black">
          <TouchableOpacity
            disabled={buttonDisabled || isPending || isCheckingRequest}
            onPress={handleRequestPost}
            className={`rounded-xl py-4 ${
              buttonDisabled || isPending || isCheckingRequest ? 'bg-gray-400' : 'bg-blue-600'
            } flex-row items-center justify-center shadow-lg`}>
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-center text-sm font-semibold text-white">{buttonLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
