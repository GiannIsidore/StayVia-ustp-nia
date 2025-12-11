import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface GenderPickerProps {
  value?: string | null;
  onChange: (gender: string | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
];

export function GenderPicker({
  value,
  onChange,
  placeholder = 'Select gender',
  label,
  className = '',
}: GenderPickerProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsVisible(false);
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <View className={className}>
      {label && <Text className="mb-2 text-sm font-medium dark:text-white">{label}</Text>}

      <TouchableOpacity
        onPress={() => setIsVisible(true)}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800">
        <View className="flex-1 flex-row items-center">
          <Ionicons name="person-outline" size={20} color="#6B7280" style={{ marginRight: 8 }} />
          <Text className={`${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
            {value || placeholder}
          </Text>
        </View>

        <View className="flex-row items-center">
          {value && (
            <TouchableOpacity onPress={handleClear} className="mr-2">
              <Ionicons name="close-circle" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-down" size={20} color="#6B7280" />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white dark:bg-gray-900">
            <View className="flex-row items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <Text className="text-lg font-semibold dark:text-white">Select Gender</Text>
              <TouchableOpacity onPress={() => setIsVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-80">
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  className={`border-b border-gray-100 px-5 py-4 dark:border-gray-800 ${
                    value === option.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}>
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-base ${
                        value === option.value
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                      {option.label}
                    </Text>
                    {value === option.value && (
                      <Ionicons name="checkmark-circle" size={24} color="#2563EB" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
