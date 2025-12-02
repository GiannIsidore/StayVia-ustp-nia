import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface DatePickerInputProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
  textColor?: string;
  borderColor?: string;
  backgroundColor?: string;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  mode = 'date',
  textColor = '#000',
  borderColor = '#ddd',
  backgroundColor = '#f5f5f5',
}) => {
  const [show, setShow] = useState(false);

  const onDateChange = (_event: any, selectedDate?: Date) => {
    // On Android, the picker closes automatically
    if (Platform.OS === 'android') {
      setShow(false);
    }

    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: textColor, marginBottom: 8 }}>
        {label}
      </Text>

      <TouchableOpacity
        onPress={() => setShow(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor,
          borderColor,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
        }}>
        <Text style={{ color: textColor, fontSize: 14 }}>{formatDate(value)}</Text>
        <Ionicons name="calendar-outline" size={20} color={textColor} />
      </TouchableOpacity>

      {show && (
        <>
          {Platform.OS === 'ios' && (
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 8,
                marginTop: 8,
                padding: 8,
              }}>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => setShow(false)}
                  style={{
                    backgroundColor: '#2563eb',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 6,
                  }}>
                  <Text style={{ color: 'white', fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={value}
                mode={mode}
                display="spinner"
                onChange={onDateChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
              />
            </View>
          )}

          {Platform.OS === 'android' && (
            <DateTimePicker
              value={value}
              mode={mode}
              display="default"
              onChange={onDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          )}
        </>
      )}
    </View>
  );
};
