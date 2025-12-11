import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';

interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  label,
  className = '',
}: DatePickerProps) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }

    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
    } else if (event.type === 'dismissed') {
      setShow(false);
    }
  };

  const showDatePicker = () => {
    setShow(true);
  };

  const clearDate = () => {
    onChange(null);
    setShow(false);
  };

  return (
    <View className={className}>
      {label && <Text className="mb-2 text-sm font-medium dark:text-white">{label}</Text>}

      <TouchableOpacity
        onPress={showDatePicker}
        className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3 dark:border-gray-600 dark:bg-gray-800">
        <View className="flex-1 flex-row items-center">
          <Ionicons name="calendar-outline" size={20} color="#6B7280" style={{ marginRight: 8 }} />
          <Text className={`${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
            {value ? format(value, 'MMM dd, yyyy') : placeholder}
          </Text>
        </View>

        {value && (
          <TouchableOpacity onPress={clearDate} className="ml-2">
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          testID="dateTimePicker"
          value={value || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={new Date()}
        />
      )}

      {Platform.OS === 'ios' && show && (
        <View className="mt-2 flex-row justify-end">
          <TouchableOpacity
            onPress={() => setShow(false)}
            className="rounded-lg bg-blue-600 px-4 py-2">
            <Text className="font-medium text-white">Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
