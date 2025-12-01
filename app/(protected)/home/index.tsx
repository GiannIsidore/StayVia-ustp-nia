import React, { useState, useMemo } from 'react';
import {
  SafeAreaView,
  FlatList,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { PostCard } from '@/components/home/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from 'expo-router';
import { useAppTheme } from '@/lib/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/lib/supabase';
import { fetchPostsWithUser } from '@/services/postService';
import { fetchPostFavoritesByUserId } from '@/services/favorites';
import { fetchRequestByUserId } from '@/services/requestService';
import { useUser } from '@clerk/clerk-expo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getUserById } from '@/services/userService';

export default function Home() {
  const supabase = useSupabase();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showTypes, setShowTypes] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<{
    label: string;
    min: number;
    max: number;
  } | null>(null);

  const budgetRanges = [
    { label: 'Under ₱3,000/month', min: 0, max: 3000 },
    { label: '₱3,000 - ₱5,000/month', min: 3000, max: 5000 },
    { label: '₱5,000 - ₱8,000/month', min: 5000, max: 8000 },
    { label: 'Above ₱8,000/month', min: 8000, max: Infinity },
  ];

  const baseTypes = ['Rent', 'Post', 'Favorites', 'Requests'];
  const typeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    Rent: 'home-outline',
    Post: 'person-outline',
    Favorites: 'heart-outline',
    Requests: 'help-outline',
  };

  // --------------------------
  // Fetch all posts
  // --------------------------
  const {
    data: posts = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['posts'],
    queryFn: () => fetchPostsWithUser(supabase),
    staleTime: 1000 * 60,
  });

  // --------------------------
  // Fetch all unique filters from Supabase
  // --------------------------
  // const { data: filters = [], isFetching: isFetchingFilters } = useQuery({
  //   queryKey: ["filters"],
  //   queryFn: async () => {
  //     const { data, error } = await supabase.from("posts").select("filters");
  //     if (error) throw error;
  //     const allFilters = (data ?? [])
  //       .flatMap((post) => (Array.isArray(post.filters) ? post.filters : []))
  //       .filter(Boolean);
  //     return Array.from(new Set(allFilters)); // unique
  //   },
  //   staleTime: 1000 * 60 * 5,
  // });

  // const allTypes = [...baseTypes, ...filters.map((f) => String(f))];

  const { data: filterData, isFetching: isFetchingFilters } = useQuery({
    queryKey: ['filters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('posts').select('filters, beds');
      if (error) throw error;

      const allFilters = (data ?? [])
        .flatMap((post) => (Array.isArray(post.filters) ? post.filters : []))
        .filter(Boolean);

      const roomCapacities = Array.from(
        new Set(
          (data ?? [])
            .map((post) => post.beds)
            .filter((b): b is string => typeof b === 'string' && b.length > 0)
        )
      );

      return {
        allFilters: Array.from(new Set(allFilters)),
        roomCapacities,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const filters = filterData?.allFilters ?? [];
  const roomCapacities = filterData?.roomCapacities ?? [];

  const allTypes = [...baseTypes, ...filters.map((f) => String(f))];

  // --------------------------
  // Fetch user favorites
  // --------------------------
  const {
    data: favoritePosts = [],
    isFetching: isFetchingFavorites,
    refetch: refetchFavorites,
  } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => (user ? fetchPostFavoritesByUserId(supabase, user.id) : Promise.resolve([])),
    enabled: !!user,
  });
  // --------------------------
  // Fetch user
  // --------------------------

  const id = user?.id;
  const { data: currentUser, error: userError } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserById(id as string, supabase),
    enabled: !!id,
  });

  const currentAccountType = currentUser?.account_type;

  // --------------------------
  // Fetch user requests
  // --------------------------
  const {
    data: userRequests = [],
    isFetching: isFetchingRequests,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['requests', user?.id],
    queryFn: () => (user ? fetchRequestByUserId(user.id, null, supabase) : Promise.resolve([])),
    enabled: !!user,
  });

  // --------------------------
  // Filter posts by type + search + filters
  // --------------------------
  const filteredPosts = useMemo(() => {
    if (!posts) return [];

    let filtered: typeof posts = posts;

    if (selectedType) {
      if (selectedType === 'Favorites') {
        filtered =
          favoritePosts?.map((fav) => fav.post).filter((p): p is NonNullable<typeof p> => !!p) ??
          [];
      } else if (selectedType === 'Post') {
        filtered = posts.filter((post) => post.post_user?.id === user?.id);
      } else if (selectedType === 'Requests') {
        filtered =
          userRequests?.map((req) => req.post).filter((p): p is NonNullable<typeof p> => !!p) ?? [];
      } else if (selectedType !== 'Rent') {
        filtered = posts.filter((post) => {
          const postFilters = Array.isArray(post.filters) ? post.filters.map(String) : [];
          return postFilters.includes(selectedType);
        });
      }
    }

    // if (selectedFilters.length > 0) {
    //   filtered = filtered.filter((post) => {
    //     const postFilters = Array.isArray(post.filters) ? post.filters.map(String) : [];
    //     return selectedFilters.every((sf) => postFilters.includes(sf));
    //   });
    // }
    if (selectedFilters.length > 0) {
      filtered = filtered.filter((post) => {
        const matchesFilter = selectedFilters.some((filter) => {
          // Match room capacity
          if (filter === post.beds) return true;
          // Match other filters (like utilities)
          return Array.isArray(post.filters) && post.filters.includes(filter);
        });
        return matchesFilter;
      });
    }

    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter((post) => {
        const title = String(post.title ?? '').toLowerCase();
        const desc = String(post.description ?? '').toLowerCase();
        const firstName = String(post.post_user?.firstname ?? '').toLowerCase();
        const lastName = String(post.post_user?.lastname ?? '').toLowerCase();
        const postFilters = Array.isArray(post.filters) ? post.filters.map(String) : [];
        return (
          title.includes(lowerSearch) ||
          desc.includes(lowerSearch) ||
          firstName.includes(lowerSearch) ||
          lastName.includes(lowerSearch) ||
          postFilters.some((f) => f.toLowerCase().includes(lowerSearch))
        );
      });
    }
    if (selectedBudget) {
      filtered = filtered.filter((post) => {
        const price = Number(post.price_per_night) || 0;
        return price >= selectedBudget.min && price < selectedBudget.max;
      });
    }

    return filtered;
  }, [
    selectedType,
    posts,
    favoritePosts,
    userRequests,
    search,
    selectedFilters,
    user,
    selectedBudget,
  ]);

  // --------------------------
  // Render
  // --------------------------
  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingTop: insets.top || 22,
        backgroundColor: colors.background,
      }}>
      {/* Header / Logo */}
      <View
        // className="bg-primary"
        style={{
          backgroundColor: colors.primary,
          alignItems: 'center',
          paddingVertical: 8,
        }}>
        <Image
          alt="App Logo"
          source={require('@/assets/images/icon-white.png')}
          style={{ width: 160, height: 96 }}
        />
      </View>

      {/* Search + Filter */}
      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.card,
              borderRadius: 9999,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Input
              placeholder="Search..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, borderWidth: 0, color: colors.foreground }}
            />
            <Ionicons name="search" size={20} color={colors.mutedForeground} />
          </View>

          <View style={{ flexDirection: 'row', paddingLeft: 6 }}>
            <TouchableOpacity
              onPress={() => setShowTypes(!showTypes)}
              style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
              <Ionicons
                name={showTypes ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={20}
                color={colors.foreground}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowFilter(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
              <Ionicons name="filter-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(protected)/landlord-rentals')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.border,
                marginLeft: 6,
              }}>
              <Ionicons name="key-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ✅ Active Filter <Badge /> */}
        {selectedFilters.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
            contentContainerStyle={{ alignItems: 'center' }}>
            {selectedFilters.map((filter) => (
              <Badge
                key={filter}
                variant="outline"
                className="mr-2 flex-row items-center rounded-full border border-border bg-card px-3 py-1">
                <Text className="mr-1 text-xs font-medium">{filter}</Text>
                <TouchableOpacity
                  onPress={() => setSelectedFilters((prev) => prev.filter((f) => f !== filter))}>
                  <Ionicons name="close" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </Badge>
            ))}

            {/* Clear All Badge */}
            <Badge
              variant="default"
              className="flex-row items-center rounded-full bg-primary px-3 py-1"
              asChild>
              <TouchableOpacity onPress={() => setSelectedFilters([])}>
                <View className="flex-row items-center">
                  <Ionicons name="close-circle-outline" size={14} color="white" />
                  <Text className="ml-1 text-xs font-medium text-white">Clear all</Text>
                </View>
              </TouchableOpacity>
            </Badge>
          </ScrollView>
        )}
      </View>

      {showTypes && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            marginTop: 8,
          }}>
          {baseTypes.map((typeName) => {
            const isSelected = selectedType === typeName;
            return (
              <TouchableOpacity
                key={typeName}
                onPress={() => {
                  const newType = isSelected ? null : typeName;
                  setSelectedType(newType);
                  if (newType === 'Favorites') {
                    queryClient.invalidateQueries({ queryKey: ['favorites'] });
                  } else if (newType === 'Requests') {
                    queryClient.invalidateQueries({ queryKey: ['requests'] });
                  }
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 6,
                  marginHorizontal: 4,
                  borderRadius: 20,
                }}>
                <Ionicons
                  name={typeIcons[typeName]}
                  size={28}
                  color={isSelected ? 'white' : colors.primary}
                  style={{
                    borderRadius: 99,
                    padding: 8,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  }}
                />
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: isSelected ? colors.primary : colors.foreground,
                  }}>
                  {typeName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showFilter}
        onRequestClose={() => setShowFilter(false)}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="w-11/12 rounded-xl bg-card p-5" style={{ maxHeight: 500 }}>
            <Text className="mb-3 text-lg font-bold text-foreground">Filter Options</Text>

            <ScrollView className="max-h-64">
              <Text className="mb-2 mt-4 text-base font-semibold text-foreground">Price/Month</Text>

              {budgetRanges.map((budget) => {
                const isSelected = selectedBudget?.label === budget.label;
                return (
                  <Button
                    key={budget.label}
                    variant={isSelected ? 'default' : 'outline'}
                    className="mb-2"
                    onPress={() => setSelectedBudget(isSelected ? null : budget)}>
                    <Text className={isSelected ? 'text-white' : 'text-foreground'}>
                      {budget.label}
                    </Text>
                  </Button>
                );
              })}

              <Text className="mb-2 mt-4 text-base font-semibold text-foreground">
                Utilities/Features/Sex
              </Text>
              {filters.map((filter) => {
                const filterLabel = String(filter);
                const isSelected = selectedFilters.includes(filterLabel);

                return (
                  <Button
                    key={filterLabel}
                    variant={isSelected ? 'default' : 'outline'}
                    className="mb-2"
                    onPress={() => {
                      setSelectedFilters((prev) =>
                        isSelected ? prev.filter((f) => f !== filterLabel) : [...prev, filterLabel]
                      );
                    }}>
                    <Text className={isSelected ? 'text-white' : 'text-foreground'}>
                      {filterLabel}
                    </Text>
                  </Button>
                );
              })}
              <Text className="mb-2 mt-4 text-base font-semibold text-foreground">
                Room Capacity
              </Text>

              {roomCapacities.map((capacity) => {
                const isSelected = selectedFilters.includes(capacity);

                return (
                  <Button
                    key={capacity}
                    variant={isSelected ? 'default' : 'outline'}
                    className="mb-2"
                    onPress={() => {
                      setSelectedFilters((prev) =>
                        isSelected ? prev.filter((f) => f !== capacity) : [...prev, capacity]
                      );
                    }}>
                    <Text className={isSelected ? 'text-white' : 'text-foreground'}>
                      {capacity}
                    </Text>
                  </Button>
                );
              })}
            </ScrollView>

            <View className="mt-4 flex-row justify-end space-x-3">
              <Button variant="ghost" onPress={() => setShowFilter(false)} className="px-4 py-2">
                <Text className="text-muted-foreground">Cancel</Text>
              </Button>

              <Button onPress={() => setShowFilter(false)} className="bg-primary px-4 py-2">
                <Text className="font-bold text-white">Apply</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Listings */}
      <View style={{ flex: 1, marginTop: 16 }}>
        {isLoading || isFetchingFavorites || isFetchingRequests || isFetchingFilters ? (
          <View style={{ paddingHorizontal: 16 }}>
            {[...Array(5)].map((_, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Skeleton
                  style={{ height: 160, width: '100%', borderRadius: 16, marginBottom: 8 }}
                />
                <Skeleton style={{ height: 16, width: '75%', marginBottom: 4 }} />
                <Skeleton style={{ height: 16, width: '50%' }} />
              </View>
            ))}
          </View>
        ) : isError ? (
          <Text style={{ textAlign: 'center', color: colors.mutedForeground, marginTop: 40 }}>
            Error loading posts: {String((error as Error).message)}
          </Text>
        ) : filteredPosts.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="information-circle-outline" size={50} color={colors.mutedForeground} />
            <Text
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: '500',
                color: colors.mutedForeground,
              }}>
              {selectedType === 'Favorites'
                ? 'No favorites yet'
                : selectedType === 'Requests'
                  ? 'No requests found'
                  : selectedType === 'Post'
                    ? "You haven't posted anything yet"
                    : 'No posts found'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredPosts}
            keyExtractor={(item) => String(item?.id)}
            renderItem={({ item }) => (
              <Link href={`/home/post/${item?.id}`} asChild>
                <PostCard post={item} />
              </Link>
            )}
            contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching || isFetchingFavorites || isFetchingRequests}
            onRefresh={() => {
              refetch();
              refetchFavorites();
              refetchRequests();
            }}
          />
        )}
      </View>

      {/* Floating Add Post Button */}

      <TouchableOpacity
        onPress={() => router.push('/(post)')}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: colors.primary,
          width: 50,
          height: 50,
          borderRadius: 30,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}>
        <Ionicons name="add" size={32} color="white" onPress={() => router.push('/(post)')} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
