import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/lib/theme';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertPost } from '@/services/postService';
import { FormInput } from '@/components/ui/form-input';
import { ChipSelector } from '@/components/ui/chip-selector';
import { BedSelector } from '@/components/ui/bed-selector';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { Skeleton } from '@/components/ui/skeleton';
import FeatherIcon from '@expo/vector-icons/Feather';
import LocationPicker, { LocationData } from '@/components/LocationPicker';

export default function CreatePost() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [accountType, setAccountType] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Fetch user account type
  useEffect(() => {
    if (!user) return;
    const fetchUserType = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('account_type')
        .eq('id', user.id)
        .single();

      if (error) console.error(error);
      setAccountType(data?.account_type || null);
      setLoadingUser(false);
    };
    fetchUserType();
  }, [user]);

  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [uploadedImagePath, setUploadedImagePath] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    price_per_night: '',
    beds: 'Single Occupancy',
    terms_and_conditions: '',
  });

  // Helper function to convert beds to numeric max_occupancy
  const bedsToOccupancy = (beds: string): number => {
    switch (beds) {
      case 'Single Occupancy':
        return 1;
      case '2 Persons':
        return 2;
      case '3–4 Persons':
        return 4;
      default:
        return 1;
    }
  };

  const uploadImage = async (localUri: string, bucket: string) => {
    try {
      setUploading(true);
      const fileRes = await fetch(localUri);
      const arrayBuffer = await fileRes.arrayBuffer();
      const fileExt = localUri.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const path = `${Date.now()}.${fileExt}`;

      const { error, data } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
        contentType: `image/${fileExt}`,
      });

      if (error) throw error;
      return data.path;
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload image.');
      return undefined;
    } finally {
      setUploading(false);
    }
  };

  const [location, setLocation] = useState<LocationData | null>(null);

  const utilityOptions = [
    'WiFi/Internet',
    'Electricity Included',
    'Water Included',
    'Air Conditioning',
  ];
  const featureOptions = [
    'Fully Furnished',
    'Semi-Furnished',
    'Unfurnished',
    'Kitchen Access',
    'Private Room',
    'Shared Room',
    'Boarding House',
    'Dormitory',
    'Female Only',
    'Male Only',
    'Co-ed/Mixed',
  ];
  const [selectedUtilities, setSelectedUtilities] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Location will be set via LocationPicker component
  const handleLocationChange = (newLocation: LocationData) => {
    setLocation(newLocation);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let userPost: string | undefined;

      if (selectedImage) {
        userPost = await uploadImage(selectedImage, 'user-posts');
      }

      return insertPost(
        {
          title: form.title,
          description: form.description,
          price_per_night: Number(form.price_per_night),
          latitude: location?.latitude,
          longitude: location?.longitude,
          image: userPost || null,
          beds: form.beds,
          max_occupancy: bedsToOccupancy(form.beds),
          filters: [...selectedUtilities, ...selectedFeatures],
          terms_and_conditions: form.terms_and_conditions || null,
        },
        supabase
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setForm({
        title: '',
        description: '',
        price_per_night: '',
        beds: 'Single Occupancy',
        terms_and_conditions: '',
      });
      setSelectedUtilities([]);
      setSelectedFeatures([]);
      setSelectedImage(undefined);
      setUploadedImagePath(undefined);
      router.push('/home');
    },
    onError: (err: any) => {
      console.error(err);
      Alert.alert('Error', 'Failed to create post.');
    },
  });

  const handleSelectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      setSelectedImage(uri);
      const path = await uploadImage(uri, 'user-posts');
      if (path) setUploadedImagePath(path);
    }
  };

  // const handlePost = () => {
  //   if (!form.title || !form.description)
  //     return Alert.alert("Missing Fields", "Please fill all required fields.");
  //   mutate();
  // };

  const handlePost = () => {
    if (!form.title || !form.description || !form.price_per_night) {
      return Alert.alert('Missing Fields', 'Please fill all required fields.');
    }

    if (!location?.latitude || !location?.longitude) {
      return Alert.alert(
        'Location Required',
        'Please pin the property location on the map before posting.'
      );
    }

    mutate();
  };

  // --- Conditional rendering ---
  if (loadingUser) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (accountType === 'student') {
    return (
      <SafeAreaView className="flex-1">
        <View
          className="flex-row items-center justify-between border-b px-4 py-3"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}>
          <TouchableOpacity
            onPress={() => router.push('/home')}
            className={`mr-4 h-10 w-10 items-center justify-center rounded-full`}>
            <Ionicons name="close" size={25} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerClassName="flex-1 align-center justify-center p-4 pb-10">
          <Text className="mb-5 text-center text-lg font-semibold text-gray-500 dark:text-gray-300">
            Unavailable — For Students.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(createLandlord)')}
            disabled={isPending}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              paddingHorizontal: 50,
              borderRadius: 8,
              opacity: isPending ? 0.6 : 1,
              alignItems: 'center',
            }}>
            <Text className="text-base font-semibold text-white">
              {isPending ? 'Loading...' : 'Apply as Landlord'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View
        className="flex-row items-center justify-between border-b px-4 py-3"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}>
        <TouchableOpacity
          onPress={() => router.push('/home')}
          className={`mr-4 h-10 w-10 items-center justify-center rounded-full`}>
          <Ionicons name="close" size={25} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePost}
          disabled={isPending}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            opacity: isPending ? 0.6 : 1,
          }}>
          <Text className="text-sm font-semibold text-white">Create Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="p-4 pb-10">
        <FormInput
          label="Property Title"
          placeholder="e.g. Cozy Apartment"
          value={form.title}
          onChangeText={(v) => setForm({ ...form, title: v })}
          colorScheme={colors}
        />

        <FormInput
          label="Description"
          placeholder="Write something about your property"
          multiline
          value={form.description}
          onChangeText={(v) => setForm({ ...form, description: v })}
          colorScheme={colors}
        />

        <FormInput
          label="Price per Month"
          placeholder="Enter price"
          type="number"
          value={form.price_per_night}
          onChangeText={(v) => setForm({ ...form, price_per_night: v })}
          colorScheme={colors}
        />

        {/*  Beds Selector */}
        <Text className="mb-1 text-sm font-bold dark:text-white">Number of Beds</Text>
        <BedSelector
          label="Occupancy Type"
          value={form.beds}
          onChange={(val) => setForm({ ...form, beds: val })}
        />

        <Text className="my-2 text-sm font-bold dark:text-white">Property Image (Optional)</Text>
        <TouchableOpacity
          onPress={handleSelectImage}
          className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
          {selectedImage ? (
            <View>
              <Image
                source={{ uri: selectedImage }}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 10,
                  resizeMode: 'cover',
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  setSelectedImage(undefined);
                  setUploadedImagePath(undefined);
                }}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: 9999,
                  padding: 5,
                }}>
                <Ionicons name="close" size={18} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="h-32 w-32 items-center justify-center rounded bg-gray-200">
              {uploading ? (
                <Skeleton className="mb-4 h-8 w-48 rounded" />
              ) : (
                <Text className="text-center text-gray-500">Select image (optional)</Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        <ChipSelector
          options={utilityOptions}
          label="Utilities"
          selected={selectedUtilities}
          onChange={setSelectedUtilities}
          colorScheme={colors}
        />

        <ChipSelector
          options={featureOptions}
          label="Features"
          selected={selectedFeatures}
          onChange={setSelectedFeatures}
          colorScheme={colors}
        />

        {/* Terms and Conditions */}
        <FormInput
          label="Terms & Conditions (Optional)"
          placeholder="Enter any specific terms, rules, or conditions for tenants...
Examples:
• No smoking inside the property
• Curfew at 10 PM on weekdays
• Monthly cleaning required
• Guest policy: Maximum 2 guests at a time"
          multiline
          value={form.terms_and_conditions}
          onChangeText={(v) => setForm({ ...form, terms_and_conditions: v })}
          colorScheme={colors}
        />
        <Text style={{ fontSize: 12, color: '#999', marginTop: -8, marginBottom: 16 }}>
          These terms will be shown to students before they inquire about your property. If left
          blank, default terms will be used.
        </Text>

        {/* Location Picker */}
        <LocationPicker
          initialLocation={location || undefined}
          onLocationChange={handleLocationChange}
          colors={colors}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
