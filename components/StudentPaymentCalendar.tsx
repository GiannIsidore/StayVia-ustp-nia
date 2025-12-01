import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/theme';
import { googleCalendarService } from '@/services/googleCalendarService';

export interface PaymentDate {
  date: Date;
  amount: number;
  rentalId: string;
  propertyTitle: string;
  status?: 'paid' | 'unpaid' | 'overdue' | 'partial';
}

interface StudentPaymentCalendarProps {
  paymentDates: PaymentDate[];
  rentalId: string;
  propertyTitle: string;
  onSyncStatusChange?: (status: 'synced' | 'partial' | 'none') => void;
}

export const StudentPaymentCalendar: React.FC<StudentPaymentCalendarProps> = ({
  paymentDates,
  rentalId,
  propertyTitle,
  onSyncStatusChange,
}) => {
  const { colors } = useAppTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<'synced' | 'partial' | 'none'>(
    'none'
  );

  // Calculate date range for calendar display
  const dateRange = useMemo(() => {
    if (paymentDates.length === 0) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 3, 0),
      };
    }

    const dates = paymentDates.map((p) => p.date);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding months
    const start = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

    return { start, end };
  }, [paymentDates]);

  // Generate months to display
  const monthsToDisplay = useMemo(() => {
    const months = [];
    const current = new Date(dateRange.start);

    while (current <= dateRange.end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [dateRange]);

  // Group payments by date for quick lookup
  const paymentsByDate = useMemo(() => {
    const grouped: Record<string, PaymentDate> = {};
    paymentDates.forEach((payment) => {
      const dateKey = payment.date.toISOString().split('T')[0];
      grouped[dateKey] = payment;
    });
    return grouped;
  }, [paymentDates]);

  // Check sync status on mount
  React.useEffect(() => {
    if (rentalId) {
      googleCalendarService
        .getRentalSyncStatus(rentalId)
        .then((status) => {
          setCalendarSyncStatus(status);
          onSyncStatusChange?.(status);
        })
        .catch(console.error);
    }
  }, [rentalId, onSyncStatusChange]);

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Generate calendar days for a month
  const generateCalendarDays = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, monthIndex, day));
    }

    return days;
  };

  // Check if a date has a payment
  const hasPayment = (date: Date | null) => {
    if (!date) return false;
    const dateKey = date.toISOString().split('T')[0];
    return !!paymentsByDate[dateKey];
  };

  // Get payment for a specific date
  const getPayment = (date: Date | null): PaymentDate | undefined => {
    if (!date) return undefined;
    const dateKey = date.toISOString().split('T')[0];
    return paymentsByDate[dateKey];
  };

  // Get payment status color
  const getPaymentStatusColor = (status?: string) => {
    switch (status) {
      case 'paid':
        return '#10B981';
      case 'unpaid':
        return '#EF4444';
      case 'overdue':
        return '#F59E0B';
      case 'partial':
        return '#8B5CF6';
      default:
        return '#DC2626';
    }
  };

  // Handle date press
  const handleDatePress = (date: Date | null) => {
    if (!date || !hasPayment(date)) return;
    setSelectedDate(date);
  };

  // Handle adding single payment to calendar
  const handleAddPaymentToCalendar = async (payment: PaymentDate) => {
    setIsSyncing(true);
    try {
      await googleCalendarService.createPaymentEvent(payment);

      // Update sync status
      const newStatus = await googleCalendarService.getRentalSyncStatus(rentalId);
      setCalendarSyncStatus(newStatus);
      onSyncStatusChange?.(newStatus);

      alert('Payment reminder added to calendar!');
    } catch (error) {
      console.error('Failed to add payment to calendar:', error);
      alert('Failed to add payment reminder. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle syncing all payments
  const handleSyncAllPayments = async () => {
    setIsSyncing(true);
    try {
      await googleCalendarService.createRentalPaymentEvents(
        rentalId,
        propertyTitle,
        paymentDates.map((p) => p.date),
        paymentDates[0]?.amount || 0
      );

      setCalendarSyncStatus('synced');
      onSyncStatusChange?.('synced');

      alert(`All ${paymentDates.length} payment reminders added to calendar!`);
    } catch (error) {
      console.error('Failed to sync all payments:', error);
      alert('Failed to sync payment reminders. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Render month calendar
  const renderMonth = (month: Date) => {
    const days = generateCalendarDays(month);
    const monthName = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weeks = [];

    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <View key={month.toISOString()} className="mb-6">
        <Text className="mb-3 text-center text-lg font-bold" style={{ color: colors.foreground }}>
          {monthName}
        </Text>

        {/* Day headers */}
        <View className="mb-2 flex-row">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text
              key={day}
              className="flex-1 text-center text-xs font-semibold"
              style={{ color: colors.foreground }}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} className="mb-1 flex-row gap-1">
              {week.map((day, dayIndex) => {
                const payment = getPayment(day);
                const hasPaymentEvent = hasPayment(day);
                const isToday = day
                  ? day.getDate() === new Date().getDate() &&
                    day.getMonth() === new Date().getMonth() &&
                    day.getFullYear() === new Date().getFullYear()
                  : false;

                return (
                  <TouchableOpacity
                    key={dayIndex}
                    onPress={() => handleDatePress(day)}
                    disabled={!hasPaymentEvent}
                    className="aspect-square flex-1 items-center justify-center rounded-lg border"
                    style={{
                      backgroundColor: hasPaymentEvent
                        ? getPaymentStatusColor(payment?.status)
                        : colors.card,
                      borderColor: hasPaymentEvent
                        ? getPaymentStatusColor(payment?.status)
                        : colors.border,
                      borderWidth: isToday ? 2 : 1,
                      opacity: hasPaymentEvent ? 1 : 0.3,
                    }}>
                    {day ? (
                      <>
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: hasPaymentEvent ? '#fff' : colors.foreground,
                          }}>
                          {day.getDate()}
                        </Text>
                        {hasPaymentEvent && (
                          <Text className="text-xs" style={{ color: '#fff' }}>
                            💳
                          </Text>
                        )}
                      </>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>
          📅 Payment Calendar
        </Text>
        <Text className="text-sm text-gray-500">{propertyTitle}</Text>
      </View>

      {/* Calendar Sync Status */}
      <View
        className="mb-6 rounded-lg border p-4"
        style={{ borderColor: colors.border, backgroundColor: colors.card }}>
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
            Calendar Sync
          </Text>
          <View className="flex-row items-center gap-2">
            {calendarSyncStatus === 'synced' && (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text className="text-sm font-semibold text-green-600">Synced</Text>
              </>
            )}
            {calendarSyncStatus === 'partial' && (
              <>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text className="text-sm font-semibold text-yellow-600">Partial</Text>
              </>
            )}
            {calendarSyncStatus === 'none' && (
              <>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                <Text className="text-sm font-semibold text-gray-500">Not Synced</Text>
              </>
            )}
          </View>
        </View>

        <View className="flex-row gap-2">
          {calendarSyncStatus === 'none' ? (
            <TouchableOpacity
              onPress={handleSyncAllPayments}
              disabled={isSyncing}
              className="flex-1 flex-row items-center justify-center rounded-lg bg-blue-600 py-3"
              style={{ opacity: isSyncing ? 0.6 : 1 }}>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="calendar" size={20} color="#fff" />
              )}
              <Text className="ml-2 font-semibold text-white">
                {isSyncing ? 'Syncing...' : 'Sync All Payments'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSyncAllPayments}
              disabled={isSyncing}
              className="flex-1 flex-row items-center justify-center rounded-lg border border-blue-600 py-3"
              style={{ opacity: isSyncing ? 0.6 : 1 }}>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <Ionicons name="sync" size={20} color="#2563EB" />
              )}
              <Text className="ml-2 font-semibold" style={{ color: '#2563EB' }}>
                {isSyncing ? 'Syncing...' : 'Resync'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Calendar Navigation */}
      <View className="mb-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigateMonth('prev')}
          className="rounded-lg p-2"
          style={{ backgroundColor: colors.card }}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>

        <TouchableOpacity
          onPress={() => navigateMonth('next')}
          className="rounded-lg p-2"
          style={{ backgroundColor: colors.card }}>
          <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Calendar Months */}
      <View>{monthsToDisplay.map((month) => renderMonth(month))}</View>

      {/* Legend */}
      <View
        className="mb-6 mt-6 rounded-lg border p-4"
        style={{ borderColor: colors.border, backgroundColor: colors.card }}>
        <Text className="mb-3 text-sm font-semibold text-gray-500">LEGEND</Text>
        <View className="gap-2">
          <View className="flex-row items-center gap-3">
            <View className="h-4 w-4 rounded" style={{ backgroundColor: '#DC2626' }} />
            <Text className="text-sm" style={{ color: colors.foreground }}>
              Payment Due
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-4 w-4 rounded" style={{ backgroundColor: '#10B981' }} />
            <Text className="text-sm" style={{ color: colors.foreground }}>
              Paid
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-4 w-4 rounded" style={{ backgroundColor: '#F59E0B' }} />
            <Text className="text-sm" style={{ color: colors.foreground }}>
              Overdue
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="h-4 w-4 rounded" style={{ backgroundColor: '#8B5CF6' }} />
            <Text className="text-sm" style={{ color: colors.foreground }}>
              Partial
            </Text>
          </View>
        </View>
      </View>

      {/* Selected Date Details */}
      {selectedDate && hasPayment(selectedDate) && (
        <View
          className="mb-6 rounded-lg border p-4"
          style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <Text className="mb-2 text-lg font-bold" style={{ color: colors.foreground }}>
            Payment Details
          </Text>
          <Text className="mb-1" style={{ color: colors.foreground }}>
            Date:{' '}
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text className="mb-3" style={{ color: colors.foreground }}>
            Amount: ₱{getPayment(selectedDate)?.amount.toLocaleString()}
          </Text>

          <TouchableOpacity
            onPress={() => handleAddPaymentToCalendar(getPayment(selectedDate)!)}
            disabled={isSyncing}
            className="flex-row items-center justify-center rounded-lg bg-blue-600 py-3"
            style={{ opacity: isSyncing ? 0.6 : 1 }}>
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text className="ml-2 font-semibold text-white">
              {isSyncing ? 'Adding...' : 'Add to Calendar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};
