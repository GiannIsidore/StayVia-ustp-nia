import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerUser, getUserById } from '@/services/userService';
import { TablesInsert } from '@/types/database.types';
import { MultiStepStudentForm } from '@/components/auth/MultiStepStudentForm';
import { MultiStepLandlordForm } from '@/components/auth/MultiStepLandlordForm';
import { getReadableErrorMessage, logError, isDuplicateError } from '@/utils/errorHandling';

type FormValues = {
  role: 'student' | 'landlord' | '';
  firstname?: string;
  lastname?: string;
  contact: number;
  student_id?: number;
  school?: string;
  landlord_proof_id?: string;
  student_proof_id?: string;
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

export default function CreateUser() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken } = useAuth();
  const supabase = useSupabase();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [uploading, setUploading] = useState(false);
  // Renamed selectedImage to landlordSelectedImage for clarity
  const [landlordSelectedImage, setLandlordSelectedImage] = useState<string | undefined>();
  const [landlordSelectedImageBack, setLandlordSelectedImageBack] = useState<string | undefined>();
  // NEW state for student proof (front and back)
  const [studentSelectedImage, setStudentSelectedImage] = useState<string | undefined>();
  const [studentSelectedImageBack, setStudentSelectedImageBack] = useState<string | undefined>();
  const [avatar, setAvatar] = useState<string | undefined>();
  const [loading, setLoading] = useState(true); // ⏳ initial loading indicator
  const [errors, setErrors] = useState<{
    role?: string;
    firstname?: string;
    lastname?: string;
    contact?: string;
    studentIdPhoto?: string;
    studentIdPhotoBack?: string;
    landlordIdPhoto?: string;
    landlordIdPhotoBack?: string;
  }>({});

  // 🔹 Simulate 2-second loading before showing form
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // 🔹 Validate session and check authentication
  useEffect(() => {
    const validateSession = async () => {
      if (!isUserLoaded || loading) return;

      // Check if user is properly authenticated
      if (!user?.id) {
        console.log('❌ No user ID found, session may have expired');
        Alert.alert('Session Expired', 'Your session has expired. Please sign in again.', [
          {
            text: 'Sign In',
            onPress: () => router.replace('/(auth)/sign-in'),
          },
        ]);
        return;
      }

      // Try to get a fresh token to verify session is valid
      try {
        const token = await getToken();
        if (!token) {
          console.log('❌ No valid token found, session expired');
          Alert.alert('Session Expired', 'Your session has expired. Please sign in again.', [
            {
              text: 'Sign In',
              onPress: () => router.replace('/(auth)/sign-in'),
            },
          ]);
        }
      } catch (error) {
        console.log('❌ Error validating session:', error);
        Alert.alert(
          'Session Error',
          'There was a problem with your session. Please sign in again.',
          [
            {
              text: 'Sign In',
              onPress: () => router.replace('/(auth)/sign-in'),
            },
          ]
        );
      }
    };

    validateSession();
  }, [isUserLoaded, user?.id, loading, getToken, router]);

  const { control, watch, setValue } = useForm<FormValues>({
    defaultValues: { role: '' },
  });

  const role = watch('role');

  // --- Avatar Logic ---
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

  // --- Generic Proof Image Picker Logic ---
  const pickProofImageAsync = async (
    setSelectedImage: React.Dispatch<React.SetStateAction<string | undefined>>
  ) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access gallery is required!');
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
  };

  // --- Upload Logic ---
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

  const DEFAULT_AVATAR_URL =
    'https://ptwhyrlrfmpyhkwmljlu.supabase.co/storage/v1/object/public/defaults/clerkimg.png';

  // --- Mutation Logic ---
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let avatarPath: string | undefined;
      let landlordProofPath: string | undefined; // Renamed to clarify
      let landlordProofBackPath: string | undefined; // NEW
      let studentProofPath: string | undefined; // NEW
      let studentProofBackPath: string | undefined; // NEW

      if (avatar) {
        avatarPath = avatar ? await uploadImage(avatar, 'user-profiles') : DEFAULT_AVATAR_URL;
      }

      // Landlord proof upload logic (front and back)
      if (role === 'landlord' && landlordSelectedImage) {
        landlordProofPath = await uploadImage(landlordSelectedImage, 'user-profiles');
      }
      if (role === 'landlord' && landlordSelectedImageBack) {
        landlordProofBackPath = await uploadImage(landlordSelectedImageBack, 'user-profiles');
      }

      // Student proof upload logic (front and back)
      if (role === 'student' && studentSelectedImage) {
        studentProofPath = await uploadImage(studentSelectedImage, 'user-profiles');
      }
      if (role === 'student' && studentSelectedImageBack) {
        studentProofBackPath = await uploadImage(studentSelectedImageBack, 'user-profiles');
      }

      // 🚨 NEW LOGIC: Set role to landlord_unverified if landlord is selected
      const roleToSubmit = role === 'landlord' ? 'landlord_unverified' : role || '';

      // Format date of birth to string if exists
      const dobValue = watch('date_of_birth');
      const dobString = dobValue instanceof Date ? dobValue.toISOString().split('T')[0] : null;

      return registerUser(
        {
          firstname: watch('firstname'),
          lastname: watch('lastname'),
          contact: Number(watch('contact')),
          student_id: role === 'student' ? Number(watch('student_id')) : null,
          school: role === 'student' ? watch('school') : null,
          landlord_proof_id: landlordProofPath, // Submitting landlord proof path
          landlord_proof_id_back: landlordProofBackPath, // Submitting landlord proof back path
          student_proof_id: studentProofPath, // Submitting student proof path
          student_proof_id_back: studentProofBackPath, // Submitting student proof back path
          avatar: avatarPath,
          account_type: roleToSubmit, // Use the dynamically determined role
          id: user?.id || '',
          username: user?.username || '',
          email: user?.emailAddresses?.[0]?.emailAddress || '',
          // Personal fields for BOTH student AND landlord
          date_of_birth: dobString,
          gender: watch('gender'),
          religion: watch('religion'),
          nationality: watch('nationality'),
          home_address: watch('home_address'),
          city: watch('city'),
          province: watch('province'),
          postal_code: watch('postal_code'),
          parent_name: watch('parent_name'),
          parent_contact: watch('parent_contact'),
          parent_email: watch('parent_email'),
          emergency_contact_name: watch('emergency_contact_name'),
          emergency_contact_number: watch('emergency_contact_number'),
        },
        supabase
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Success', 'Profile created successfully! Welcome to StayVia!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(protected)/home'),
        },
      ]);
    },
    onError: (err: any) => {
      logError('CreateUser - registerUser', err);

      // Check for session errors specifically
      if (err?.code === 'api_response_error' && err?.details?.includes('No session was found')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please sign in again to continue.',
          [
            {
              text: 'Sign In',
              onPress: () => router.replace('/(auth)/sign-in'),
            },
          ]
        );
        return;
      }

      // Get user-friendly error message
      const errorMessage = getReadableErrorMessage(err);

      // If it's a duplicate error, it means old data exists
      // With upsert, this shouldn't happen, but just in case
      if (isDuplicateError(err)) {
        Alert.alert(
          'Account Already Exists',
          'An account with this information already exists. Your profile has been updated.',
          [
            {
              text: 'Continue to Home',
              onPress: () => router.replace('/(protected)/home'),
            },
          ]
        );
      } else {
        // Show the user-friendly error message
        Alert.alert('Registration Error', errorMessage);
      }
    },
  });

  const onSubmit = () => {
    // Reset errors
    setErrors({});

    // Validation
    const newErrors: typeof errors = {};

    if (!role) {
      newErrors.role = 'Please select a role (Student or Landlord)';
    }

    if (!watch('firstname')?.trim()) {
      newErrors.firstname = 'First name is required';
    }

    if (!watch('lastname')?.trim()) {
      newErrors.lastname = 'Last name is required';
    }

    if (!watch('contact')) {
      newErrors.contact = 'Contact number is required';
    }

    // Conditional validation for ID photos based on role
    if (role === 'student') {
      if (!studentSelectedImage) {
        newErrors.studentIdPhoto = 'Student ID Proof (Front) is required';
      }
      if (!studentSelectedImageBack) {
        newErrors.studentIdPhotoBack = 'Student ID Proof (Back) is required';
      }
    } else if (role === 'landlord') {
      if (!landlordSelectedImage) {
        newErrors.landlordIdPhoto = 'Valid ID (Front) is required';
      }
      if (!landlordSelectedImageBack) {
        newErrors.landlordIdPhotoBack = 'Valid ID (Back) is required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Validation Error', Object.values(newErrors).join('\n'));
      return;
    }

    mutate();
  };

  const clerkImg = require('@/assets/images/clerkimg.png');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-3 text-gray-600">Registering account...</Text>
      </View>
    );
  }

  // 🧩 Show skeleton if Clerk user not ready
  if (!user?.id) {
    return (
      <View className="flex-1 items-center justify-center">
        <Skeleton className="mb-4 h-8 w-48 rounded" />
      </View>
    );
  }

  // ✅ Main form
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
          <View className="mb-6 items-center">
            <TouchableOpacity onPress={pickAvatarAsync}>
              <Image
                source={avatar ? { uri: avatar } : clerkImg}
                className="h-24 w-24 rounded-full border-2 border-gray-300"
              />
              <View className="absolute bottom-0 right-0 rounded-full bg-blue-600 p-2">
                <Ionicons name="camera" size={18} color="white" />
              </View>
            </TouchableOpacity>

            {avatar && (
              <TouchableOpacity onPress={removeAvatar} className="mt-2">
                <Text className="text-red-500">Remove</Text>
              </TouchableOpacity>
            )}

            <Text className="mt-3 text-lg font-semibold dark:text-white">{user.username}</Text>
          </View>

          {/* Role selection */}
          <Text className="mb-2 text-base font-semibold">Register as:</Text>
          <View className="mb-4 flex-row gap-3">
            {['student', 'landlord'].map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setValue('role', r as 'student' | 'landlord')}
                className={`flex-1 rounded-xl border p-3 ${
                  role === r ? 'border-blue-500 dark:bg-black' : 'dark:bg-gray-500'
                }`}>
                <Text className="text-center font-medium capitalize dark:text-white">{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.role ? (
            <Text className="mb-4 text-sm font-medium text-destructive">{errors.role}</Text>
          ) : null}

          {/* Student-only fields - Multi-step form */}
          {role === 'student' && (
            <MultiStepStudentForm
              control={control}
              watch={watch}
              onSubmit={onSubmit}
              isPending={isPending}>
              {/* Student Proof ID Upload - passed as children to step 4 */}
              <View>
                <Text className="mb-2 text-sm dark:text-white">Student ID Proof (Front) *</Text>
                <TouchableOpacity
                  onPress={() => pickProofImageAsync(setStudentSelectedImage)}
                  className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
                  {studentSelectedImage ? (
                    <View>
                      <Image
                        source={{ uri: studentSelectedImage }}
                        style={{
                          width: 200,
                          height: 200,
                          borderRadius: 10,
                          resizeMode: 'cover',
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setStudentSelectedImage(undefined)}
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
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Text className="text-gray-500">Tap to select image</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
                {errors.studentIdPhoto ? (
                  <Text className="mb-4 text-sm font-medium text-destructive">
                    {errors.studentIdPhoto}
                  </Text>
                ) : null}

                <Text className="mb-2 text-sm dark:text-white">Student ID Proof (Back) *</Text>
                <TouchableOpacity
                  onPress={() => pickProofImageAsync(setStudentSelectedImageBack)}
                  className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
                  {studentSelectedImageBack ? (
                    <View>
                      <Image
                        source={{ uri: studentSelectedImageBack }}
                        style={{
                          width: 200,
                          height: 200,
                          borderRadius: 10,
                          resizeMode: 'cover',
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setStudentSelectedImageBack(undefined)}
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
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Text className="text-gray-500">Tap to select image</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
                {errors.studentIdPhotoBack ? (
                  <Text className="mb-4 text-sm font-medium text-destructive">
                    {errors.studentIdPhotoBack}
                  </Text>
                ) : null}
              </View>
            </MultiStepStudentForm>
          )}

          {/* Landlord-only multi-step form */}
          {role === 'landlord' && (
            <MultiStepLandlordForm
              control={control}
              watch={watch}
              onSubmit={onSubmit}
              isPending={isPending}>
              {/* Landlord Proof ID Upload - passed as children to step 3 */}
              <View>
                <Text className="mb-2 text-sm">Valid ID (Front) *</Text>
                <TouchableOpacity
                  onPress={() => pickProofImageAsync(setLandlordSelectedImage)}
                  className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
                  {landlordSelectedImage ? (
                    <View>
                      <Image
                        source={{ uri: landlordSelectedImage }}
                        style={{
                          width: 200,
                          height: 200,
                          borderRadius: 10,
                          resizeMode: 'cover',
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setLandlordSelectedImage(undefined)}
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
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Text className="text-gray-500">Tap to select image</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>

                <Text className="mb-2 text-sm">Valid ID (Back)</Text>
                <TouchableOpacity
                  onPress={() => pickProofImageAsync(setLandlordSelectedImageBack)}
                  className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
                  {landlordSelectedImageBack ? (
                    <View>
                      <Image
                        source={{ uri: landlordSelectedImageBack }}
                        style={{
                          width: 200,
                          height: 200,
                          borderRadius: 10,
                          resizeMode: 'cover',
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setLandlordSelectedImageBack(undefined)}
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
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Text className="text-gray-500">Tap to select image</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </MultiStepLandlordForm>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
