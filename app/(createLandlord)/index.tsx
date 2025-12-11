import React, { useState, useEffect } from 'react';
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
import { useUser } from '@clerk/clerk-expo';
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { GenderPicker } from '@/components/ui/gender-picker';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserById, registerUser, updateUser } from '@/services/userService';
import { useAppTheme } from '@/lib/theme';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

type FormValues = {
  firstname?: string;
  lastname?: string;
  contact: number;
  landlord_proof_id?: string;
  landlord_proof_id_back?: string;
  avatar?: string;
  date_of_birth?: Date | null;
  gender?: string | null;
  religion?: string;
  home_address?: string;
  parent_name?: string | null;
  parent_contact?: string | null;
};

export default function CreateLandlord() {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();

  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selectedImageFront, setSelectedImageFront] = useState<string | undefined>();
  const [selectedImageBack, setSelectedImageBack] = useState<string | undefined>();
  const [avatar, setAvatar] = useState<string | undefined>();
  const [image, setImage] = useState<string | undefined>();
  const [noParentInfo, setNoParentInfo] = useState(false);

  const totalSteps = 3;

  const { control, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      contact: undefined,
      avatar: undefined,
      firstname: undefined,
      lastname: undefined,
      date_of_birth: null,
      gender: null,
      religion: undefined,
      home_address: undefined,
      parent_name: null,
      parent_contact: null,
    },
  });

  const userId = user?.id;

  // Fetch existing user info
  const { data, error, isLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => getUserById(userId as string, supabase),
    enabled: !!userId,
  });

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

  // Prefill form fields when data is loaded
  useEffect(() => {
    if (data) {
      if (data.firstname) setValue('firstname', data.firstname);
      if (data.lastname) setValue('lastname', data.lastname);
      if (data.contact) setValue('contact', data.contact);
      if (data.religion) setValue('religion', data.religion);
      if (data.home_address) setValue('home_address', data.home_address);
      if (data.gender) setValue('gender', data.gender);
      if (data.parent_name) setValue('parent_name', data.parent_name);
      if (data.parent_contact) setValue('parent_contact', data.parent_contact);
      if (data.date_of_birth) setValue('date_of_birth', new Date(data.date_of_birth));

      if (data?.avatar) {
        downloadImage(data.avatar, supabase)
          .then((url) => setImage(url))
          .catch((err) => Alert.alert('Image not loaded', err));
      }
    }
  }, [data, setValue, data?.avatar]);

  if (error) console.error('Error loading user:', error);

  // Avatar Picker
  const pickAvatarAsync = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access gallery is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const removeAvatar = () => setAvatar(undefined);

  // ID Picker
  const pickIDImageAsync = async (setImage: (uri: string | undefined) => void) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access gallery is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  // Upload Function
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

  // Validation for each step
  const validateStep = (step: number): boolean => {
    const values = watch();

    switch (step) {
      case 1:
        if (!values.firstname?.trim()) {
          Alert.alert('Required', 'Please enter your firstname');
          return false;
        }
        if (!values.lastname?.trim()) {
          Alert.alert('Required', 'Please enter your lastname');
          return false;
        }
        if (!values.contact) {
          Alert.alert('Required', 'Please enter your contact number');
          return false;
        }
        if (!values.date_of_birth) {
          Alert.alert('Required', 'Please select your date of birth');
          return false;
        }
        if (!values.gender) {
          Alert.alert('Required', 'Please select your gender');
          return false;
        }
        return true;

      case 2:
        if (!values.home_address?.trim()) {
          Alert.alert('Required', 'Please enter your home address');
          return false;
        }
        // Parent info is required unless "No Parent Info" is checked
        if (!noParentInfo) {
          if (!values.parent_name?.trim()) {
            Alert.alert('Required', 'Please enter parent/guardian name or check "No Parent Info"');
            return false;
          }
          if (!values.parent_contact?.trim()) {
            Alert.alert(
              'Required',
              'Please enter parent/guardian contact or check "No Parent Info"'
            );
            return false;
          }
        }
        return true;

      case 3:
        if (!selectedImageFront) {
          Alert.alert('Required', 'Please upload front side of your ID');
          return false;
        }
        if (!selectedImageBack) {
          Alert.alert('Required', 'Please upload back side of your ID');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!validateStep(currentStep)) {
        throw new Error('Validation failed');
      }

      let avatarPath: string | undefined;
      let proofPathFront: string | undefined;
      let proofPathBack: string | undefined;

      avatarPath = avatar
        ? await uploadImage(avatar, 'user-profiles')
        : data?.avatar || DEFAULT_AVATAR_URL;

      if (selectedImageFront) {
        proofPathFront = await uploadImage(selectedImageFront, 'user-profiles');
      }

      if (selectedImageBack) {
        proofPathBack = await uploadImage(selectedImageBack, 'user-profiles');
      }

      // Format date of birth
      const dobValue = watch('date_of_birth');
      const dobString = dobValue instanceof Date ? dobValue.toISOString().split('T')[0] : null;

      const payload = {
        firstname: watch('firstname'),
        lastname: watch('lastname'),
        contact: Number(watch('contact')),
        landlord_proof_id: proofPathFront,
        landlord_proof_id_back: proofPathBack,
        avatar: avatarPath,
        account_type: 'landlord',
        id: user?.id || '',
        username: user?.username || '',
        email: user?.emailAddresses?.[0]?.emailAddress || '',
        date_of_birth: dobString,
        gender: watch('gender'),
        religion: watch('religion'),
        home_address: watch('home_address'),
        parent_name: noParentInfo ? null : watch('parent_name'),
        parent_contact: noParentInfo ? null : watch('parent_contact'),
      };

      if (data) {
        return updateUser(user?.id as string, payload, supabase);
      } else {
        return registerUser(payload, supabase);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.replace('/(protected)/home');
      Alert.alert('Success', 'Landlord account created successfully!');
    },
    onError: (err: any) => {
      console.error(err);
      Alert.alert('Error', 'Failed to register landlord account.');
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Skeleton className="mb-4 h-8 w-48 rounded" />
      </View>
    );
  }

  if (isPending) {
    return <ActivityIndicator size="large" className="flex-1 items-center justify-center" />;
  }

  // Progress Bar
  const renderProgressBar = () => (
    <View className="mb-6 px-4">
      <View className="mb-2 flex-row justify-between">
        <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Step {currentStep} of {totalSteps}
        </Text>
        <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {Math.round((currentStep / totalSteps) * 100)}%
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <View
          className="h-full bg-blue-600"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </View>

      {/* Step Labels */}
      <View className="mt-3 flex-row justify-between">
        {['Personal', 'Address', 'Documents'].map((label, index) => (
          <View key={label} className="items-center">
            <View
              className={`h-8 w-8 items-center justify-center rounded-full ${
                index + 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
              {index + 1 < currentStep ? (
                <Ionicons name="checkmark" size={18} color="white" />
              ) : (
                <Text className="text-xs font-semibold text-white">{index + 1}</Text>
              )}
            </View>
            <Text
              className={`mt-1 text-xs ${
                index + 1 === currentStep
                  ? 'font-semibold text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Step 1: Personal Information
  const renderStep1 = () => (
    <View>
      <Text className="mb-4 text-xl font-bold dark:text-white">Personal Information</Text>

      <Label className="text-sm">Firstname *</Label>
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

      <Label className="text-sm">Lastname *</Label>
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

      <Label className="text-sm">Contact Number *</Label>
      <Controller
        control={control}
        name="contact"
        render={({ field: { onChange, value } }) => (
          <Input
            placeholder="Enter your contact number"
            keyboardType="phone-pad"
            value={value?.toString() || ''}
            onChangeText={onChange}
            className="mb-4"
          />
        )}
      />

      <Controller
        control={control}
        name="date_of_birth"
        render={({ field: { onChange, value } }) => (
          <DatePicker
            label="Date of Birth *"
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
            label="Gender *"
            value={value}
            onChange={onChange}
            placeholder="Select your gender"
            className="mb-4"
          />
        )}
      />

      <Label className="text-sm">Religion (Optional)</Label>
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
    </View>
  );

  // Step 2: Address & Parent Information
  const renderStep2 = () => (
    <View>
      <Text className="mb-4 text-xl font-bold dark:text-white">
        Address & Parent/Guardian Information
      </Text>

      <Label className="text-sm">Home Address *</Label>
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

      <Text className="mb-2 mt-4 text-lg font-semibold dark:text-white">
        Parent/Guardian Information
      </Text>
      <Text className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Required: Enter parent/guardian information or check the box below if not available
      </Text>

      <TouchableOpacity
        onPress={() => setNoParentInfo(!noParentInfo)}
        className="mb-4 flex-row items-center rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <View
          className={`mr-3 h-5 w-5 items-center justify-center rounded border-2 ${
            noParentInfo ? 'border-blue-600 bg-blue-600' : 'border-gray-400 dark:border-gray-500'
          }`}>
          {noParentInfo && <Ionicons name="checkmark" size={14} color="white" />}
        </View>
        <Text className="text-sm dark:text-white">Parent/Guardian information not available</Text>
      </TouchableOpacity>

      {!noParentInfo && (
        <>
          <Label className="text-sm">Parent/Guardian Name *</Label>
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

          <Label className="text-sm">Parent/Guardian Contact *</Label>
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
        </>
      )}
    </View>
  );

  // Step 3: Documents
  const renderStep3 = () => (
    <View>
      <Text className="mb-4 text-xl font-bold dark:text-white">Verification Documents</Text>

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
          {user?.username ? user?.username : `${data?.firstname ?? ''} ${data?.lastname ?? ''}`}
        </Text>
      </View>

      {/* ID Front */}
      <Text className="mb-2 text-sm dark:text-white">Valid ID (Front) *</Text>
      <TouchableOpacity
        onPress={() => pickIDImageAsync(setSelectedImageFront)}
        className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
        {selectedImageFront ? (
          <View>
            <Image
              source={{ uri: selectedImageFront }}
              style={{
                width: 200,
                height: 200,
                borderRadius: 10,
                resizeMode: 'cover',
              }}
            />
            <TouchableOpacity
              onPress={() => setSelectedImageFront(undefined)}
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
              <Text className="text-gray-500">Tap to select image</Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* ID Back */}
      <Text className="mb-2 text-sm dark:text-white">Valid ID (Back) *</Text>
      <TouchableOpacity
        onPress={() => pickIDImageAsync(setSelectedImageBack)}
        className="relative mb-4 items-center justify-center rounded-xl border border-dashed border-gray-400 p-3">
        {selectedImageBack ? (
          <View>
            <Image
              source={{ uri: selectedImageBack }}
              style={{
                width: 200,
                height: 200,
                borderRadius: 10,
                resizeMode: 'cover',
              }}
            />
            <TouchableOpacity
              onPress={() => setSelectedImageBack(undefined)}
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
              <Text className="text-gray-500">Tap to select image</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {/* Back Button */}
      <View
        className="flex-row items-center justify-between border-b px-4 py-3"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}>
        <Ionicons name="close" size={25} color={colors.foreground} onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        {renderProgressBar()}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </ScrollView>

        <View className="flex-row gap-3 px-4 pb-4">
          {currentStep > 1 && (
            <Button
              onPress={handleBack}
              className="flex-1 bg-gray-200 dark:bg-gray-700"
              disabled={isPending}>
              <Text className="font-medium text-gray-700 dark:text-white">Back</Text>
            </Button>
          )}

          {currentStep < totalSteps ? (
            <Button
              onPress={handleNext}
              className={currentStep === 1 ? 'flex-1' : 'flex-1'}
              disabled={isPending}>
              <Text className="font-medium text-white">Next</Text>
            </Button>
          ) : (
            <Button onPress={() => mutate()} className="flex-1" disabled={isPending}>
              <Text className="font-medium text-white">
                {isPending ? 'Registering...' : 'Register Landlord Account'}
              </Text>
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
