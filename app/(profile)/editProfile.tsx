import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserById, updateUser } from '@/services/userService';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import HeaderBtn from '@/components/HeaderBtn';
import { DatePicker } from '@/components/ui/date-picker';
import { GenderPicker } from '@/components/ui/gender-picker';

type FormValues = {
  role: 'student' | 'landlord' | 'landlord_unverified' | '';
  firstname?: string;
  lastname?: string;
  contact: number;
  student_id?: number;
  school?: string;
  landlord_proof_id?: string;
  avatar?: string;
  date_of_birth?: Date | null;
  gender?: string | null;
  religion?: string;
  nationality?: string;
  home_address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  parent_name?: string | null;
  parent_contact?: string | null;
  parent_email?: string | null;
  emergency_contact_name?: string;
  emergency_contact_number?: string;
};

// 🚨 NEW HELPER FUNCTION to check if the role is any type of landlord
const isLandlordRole = (currentRole: string | undefined): boolean => {
  return currentRole === 'landlord' || currentRole === 'landlord_unverified';
};

export default function CreateUser() {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [avatar, setAvatar] = useState<string | undefined>();
  const [image, setImage] = useState<string | undefined>();

  const id = user?.id;

  // Fetch user data
  const { data, error, isLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserById(id as string, supabase),
    enabled: !!id,
  });

  // 🚨 Role now includes 'landlord_unverified' possibility
  const role = data?.account_type as FormValues['role'];

  const { control, watch } = useForm<FormValues>({
    defaultValues: {
      role: role || '',
      firstname: data?.firstname || '',
      lastname: data?.lastname || '',
      contact: data?.contact || 0,
      student_id: data?.student_id || undefined,
      school: data?.school || '',
      landlord_proof_id: data?.landlord_proof_id || '',
      avatar: data?.avatar || '',
      date_of_birth: data?.date_of_birth ? new Date(data.date_of_birth) : null,
      gender: data?.gender || null,
      religion: data?.religion || '',
      nationality: data?.nationality || '',
      home_address: data?.home_address || '',
      city: data?.city || '',
      province: data?.province || '',
      postal_code: data?.postal_code || '',
      parent_name: data?.parent_name || null,
      parent_contact: data?.parent_contact || null,
      parent_email: data?.parent_email || null,
      emergency_contact_name: data?.emergency_contact_name || '',
      emergency_contact_number: data?.emergency_contact_number || '',
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let avatarPath: string | undefined;
      let proofPath: string | undefined;

      // Determine if the current role requires landlord proof logic
      const requiresLandlordProof = isLandlordRole(role);

      if (avatar) avatarPath = await uploadImage(avatar, 'user-profiles');

      // 🚨 Use the new helper function for the mutation logic
      if (requiresLandlordProof && selectedImage)
        proofPath = await uploadImage(selectedImage, 'user-profiles');

      // Format date of birth to string if exists
      const dobValue = watch('date_of_birth');
      const dobString = dobValue instanceof Date ? dobValue.toISOString().split('T')[0] : null;

      return updateUser(
        user?.id || '',
        {
          firstname: watch('firstname'),
          lastname: watch('lastname'),
          contact: Number(watch('contact')),
          student_id: role === 'student' ? Number(watch('student_id')) : null,
          school: role === 'student' ? watch('school') : null,
          landlord_proof_id: proofPath,
          avatar: avatarPath,
          account_type: role || '',
          username: user?.username || '',
          email: user?.emailAddresses?.[0]?.emailAddress || '',
          // New student fields
          date_of_birth: role === 'student' ? dobString : null,
          gender: role === 'student' ? watch('gender') : null,
          religion: role === 'student' ? watch('religion') : null,
          nationality: role === 'student' ? watch('nationality') : null,
          home_address: role === 'student' ? watch('home_address') : null,
          city: role === 'student' ? watch('city') : null,
          province: role === 'student' ? watch('province') : null,
          postal_code: role === 'student' ? watch('postal_code') : null,
          parent_name: role === 'student' ? watch('parent_name') : null,
          parent_contact: role === 'student' ? watch('parent_contact') : null,
          parent_email: role === 'student' ? watch('parent_email') : null,
          emergency_contact_name: role === 'student' ? watch('emergency_contact_name') : null,
          emergency_contact_number: role === 'student' ? watch('emergency_contact_number') : null,
        },
        supabase
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.replace('/(protected)/home');
      Alert.alert('Success', 'Account updated successfully!');
    },
    onError: (err: any) => {
      console.error(err);
      Alert.alert('Error', 'Failed to update account.');
    },
  });

  const onSubmit = () => mutate();

  // 🆕 Avatar Picker
  const pickAvatarAsync = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access gallery is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const removeAvatar = () => setAvatar(undefined);

  // Upload image helper
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

  // Download image helper
  const downloadImage = async (
    path: string,
    supabase: SupabaseClient<Database>
  ): Promise<string> => {
    const { data, error } = await supabase.storage.from('user-profiles').download(path);

    if (error || !data) throw error || new Error('Failed to download image');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(data);
    });
  };

  useEffect(() => {
    if (data?.avatar) {
      downloadImage(data.avatar, supabase)
        .then((url) => setImage(url))
        .catch((err) => Alert.alert('Image not loaded', err));
    }

    // 🚨 Use the helper function here to download landlord proof image if user is any type of landlord
    if (data?.landlord_proof_id && isLandlordRole(role)) {
      downloadImage(data.landlord_proof_id, supabase)
        .then((url) => setSelectedImage(url))
        .catch((err) => Alert.alert('Image not loaded', err));
    }
  }, [data?.avatar, data?.landlord_proof_id, role]); // Added 'role' to dependency array

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled">
          {(isLoading || !user?.id) && (
            <View className="flex-1 items-center justify-center">
              <Skeleton className="mb-4 h-8 w-48 rounded" />
              <Text className="text-gray-900 dark:text-white">Loading...</Text>
            </View>
          )}

          {!isLoading && user?.id && (
            <>
              <HeaderBtn title="Edit Profile" />

              {/* Avatar Section */}
              <View className="mb-6 items-center">
                <TouchableOpacity onPress={pickAvatarAsync}>
                  <Image
                    source={{ uri: avatar || image }}
                    className="h-24 w-24 rounded-full border-2 border-gray-300"
                  />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      backgroundColor: '#2563eb',
                      borderRadius: 9999,
                      padding: 4,
                    }}>
                    <Ionicons name="camera" size={18} color="white" />
                  </View>
                </TouchableOpacity>

                {avatar && (
                  <TouchableOpacity onPress={removeAvatar} className="mt-2">
                    <Text className="text-red-500">Remove</Text>
                  </TouchableOpacity>
                )}

                <Text className="mt-3 text-sm font-semibold text-gray-500 dark:text-white">
                  {user.username}
                </Text>
              </View>

              {/* Common Fields */}
              <Label className="text-sm">Firstname</Label>
              <Controller
                control={control}
                name="firstname"
                render={({ field: { onChange, value } }) => (
                  <Input
                    placeholder="Enter your firstname"
                    value={value}
                    onChangeText={onChange}
                    className="mb-4"
                  />
                )}
              />

              <Label className="text-sm">Lastname</Label>
              <Controller
                control={control}
                name="lastname"
                render={({ field: { onChange, value } }) => (
                  <Input
                    placeholder="Enter your lastname"
                    value={value}
                    onChangeText={onChange}
                    className="mb-4"
                  />
                )}
              />

              <Label className="text-sm">Contact Number</Label>
              <Controller
                control={control}
                name="contact"
                render={({ field: { onChange, value } }) => (
                  <Input
                    placeholder="Enter your contact number"
                    keyboardType="number-pad"
                    value={value?.toString() || ''}
                    onChangeText={onChange}
                    className="mb-4"
                  />
                )}
              />

              {/* Student Fields */}
              {role === 'student' && (
                <>
                  {/* Personal Information Section */}
                  <View className="mb-4 mt-6">
                    <Text className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                      Personal Information
                    </Text>
                    <View className="mb-4 h-0.5 bg-gray-200 dark:bg-gray-700" />
                  </View>

                  <Controller
                    control={control}
                    name="date_of_birth"
                    render={({ field: { onChange, value } }) => (
                      <DatePicker
                        label="Date of Birth"
                        value={value}
                        onChange={onChange}
                        placeholder="Select your date of birth"
                        className="mb-4"
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name="gender"
                    render={({ field: { onChange, value } }) => (
                      <GenderPicker
                        label="Gender"
                        value={value}
                        onChange={onChange}
                        placeholder="Select your gender"
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Religion</Label>
                  <Controller
                    control={control}
                    name="religion"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your religion"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Nationality</Label>
                  <Controller
                    control={control}
                    name="nationality"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your nationality"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  {/* Address Information Section */}
                  <View className="mb-4 mt-6">
                    <Text className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                      Address Information
                    </Text>
                    <View className="mb-4 h-0.5 bg-gray-200 dark:bg-gray-700" />
                  </View>

                  <Label className="text-sm">Home Address</Label>
                  <Controller
                    control={control}
                    name="home_address"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your complete home address"
                        value={value}
                        onChangeText={onChange}
                        multiline
                        numberOfLines={3}
                        className="mb-4"
                        style={{ minHeight: 80 }}
                      />
                    )}
                  />

                  <Label className="text-sm">City</Label>
                  <Controller
                    control={control}
                    name="city"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your city"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Province/State</Label>
                  <Controller
                    control={control}
                    name="province"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your province or state"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Postal Code</Label>
                  <Controller
                    control={control}
                    name="postal_code"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your postal code"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  {/* Parent/Guardian Information Section */}
                  <View className="mb-4 mt-6">
                    <Text className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                      Parent/Guardian Information
                    </Text>
                    <View className="mb-4 h-0.5 bg-gray-200 dark:bg-gray-700" />
                  </View>

                  <Label className="text-sm">Parent/Guardian Name</Label>
                  <Controller
                    control={control}
                    name="parent_name"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter parent or guardian name"
                        value={value || ''}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Parent/Guardian Contact</Label>
                  <Controller
                    control={control}
                    name="parent_contact"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter parent or guardian contact number"
                        keyboardType="phone-pad"
                        value={value || ''}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Parent/Guardian Email</Label>
                  <Controller
                    control={control}
                    name="parent_email"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter parent or guardian email"
                        keyboardType="email-address"
                        value={value || ''}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  {/* School Information Section */}
                  <View className="mb-4 mt-6">
                    <Text className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                      School Information
                    </Text>
                    <View className="mb-4 h-0.5 bg-gray-200 dark:bg-gray-700" />
                  </View>

                  <Label className="text-sm">Student ID</Label>
                  <Controller
                    control={control}
                    name="student_id"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your Student ID"
                        keyboardType="number-pad"
                        value={value?.toString() || ''}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">School</Label>
                  <Controller
                    control={control}
                    name="school"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter your school name"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  {/* Emergency Contact Section */}
                  <View className="mb-4 mt-6">
                    <Text className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                      Emergency Contact
                    </Text>
                    <View className="mb-4 h-0.5 bg-gray-200 dark:bg-gray-700" />
                  </View>

                  <Label className="text-sm">Emergency Contact Name</Label>
                  <Controller
                    control={control}
                    name="emergency_contact_name"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter emergency contact name"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />

                  <Label className="text-sm">Emergency Contact Number</Label>
                  <Controller
                    control={control}
                    name="emergency_contact_number"
                    render={({ field: { onChange, value } }) => (
                      <Input
                        placeholder="Enter emergency contact number"
                        keyboardType="phone-pad"
                        value={value}
                        onChangeText={onChange}
                        className="mb-4"
                      />
                    )}
                  />
                </>
              )}

              {/* Landlord Proof */}
              {/* 🚨 CONDITIONAL RENDERING: Use the helper function */}
              {isLandlordRole(role) && (
                <>
                  <Text className="mb-2 text-sm">Valid ID Proof</Text>
                  <TouchableOpacity
                    onPress={async () => {
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
                        setSelectedImage(result.assets[0].uri);
                      }
                    }}
                    className="mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
                    {uploading ? (
                      <Skeleton className="mb-4 h-8 w-48 rounded" />
                    ) : (
                      <Text className="text-gray-500">Tap to select image</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Submit */}
              <Button className="mt-4" disabled={isPending} onPress={onSubmit}>
                <Text className="font-medium text-white">
                  {isPending ? 'Updating...' : 'Update Account'}
                </Text>
              </Button>
            </>
          )}
          <Link
            href="https://cdn.mtdv.me/video/rick.mp4"
            target="_blank"
            className="mt-10 text-center text-sm text-gray-200 opacity-10 blur-[0.5px] dark:text-gray-800">
            s
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
