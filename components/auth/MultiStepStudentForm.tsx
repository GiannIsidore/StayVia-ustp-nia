import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Control, Controller, UseFormWatch } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { GenderPicker } from '@/components/ui/gender-picker';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface StudentFormData {
  firstname?: string;
  lastname?: string;
  contact: number;
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
  student_id?: number;
  school?: string;
}

interface MultiStepStudentFormProps {
  control: Control<any>;
  watch: UseFormWatch<any>;
  onSubmit: () => void;
  isPending: boolean;
  children: React.ReactNode; // For student proof upload section
}

export function MultiStepStudentForm({
  control,
  watch,
  onSubmit,
  isPending,
  children,
}: MultiStepStudentFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [noParentInfo, setNoParentInfo] = useState(false);

  const totalSteps = 4;

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
        return true;

      case 2:
        if (!values.home_address?.trim()) {
          Alert.alert('Required', 'Please enter your home address');
          return false;
        }
        if (!values.city?.trim()) {
          Alert.alert('Required', 'Please enter your city');
          return false;
        }
        if (!values.province?.trim()) {
          Alert.alert('Required', 'Please enter your province/state');
          return false;
        }
        return true;

      case 3:
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

      case 4:
        if (!values.student_id) {
          Alert.alert('Required', 'Please enter your student ID');
          return false;
        }
        if (!values.school?.trim()) {
          Alert.alert('Required', 'Please enter your school name');
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

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      onSubmit();
    }
  };

  const renderProgressBar = () => (
    <View className="mb-6">
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
        {['Personal', 'Address', 'Parent', 'School'].map((label, index) => (
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
    </View>
  );

  const renderStep2 = () => (
    <View>
      <Text className="mb-4 text-xl font-bold dark:text-white">Address Information</Text>

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

      <Label className="text-sm">City *</Label>
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

      <Label className="text-sm">Province/State *</Label>
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
    </View>
  );

  const renderStep3 = () => (
    <View>
      <Text className="mb-2 text-xl font-bold dark:text-white">Parent/Guardian Information</Text>
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

          <Label className="text-sm">Parent/Guardian Email</Label>
          <Controller
            control={control}
            name="parent_email"
            render={({ field: { onChange, value } }) => (
              <Input
                placeholder="Enter parent or guardian email (optional)"
                keyboardType="email-address"
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

  const renderStep4 = () => (
    <View>
      <Text className="mb-4 text-xl font-bold dark:text-white">School & Emergency Contact</Text>

      <Label className="text-sm">Student ID *</Label>
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

      <Label className="text-sm">School *</Label>
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

      {children}

      <Text className="mb-3 mt-6 text-lg font-semibold dark:text-white">
        Emergency Contact (Optional)
      </Text>

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
    </View>
  );

  return (
    <View className="flex-1">
      {renderProgressBar()}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </ScrollView>

      <View className="mt-4 flex-row gap-3">
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
          <Button onPress={handleSubmit} className="flex-1" disabled={isPending}>
            <Text className="font-medium text-white">
              {isPending ? 'Registering...' : 'Register Account'}
            </Text>
          </Button>
        )}
      </View>
    </View>
  );
}
