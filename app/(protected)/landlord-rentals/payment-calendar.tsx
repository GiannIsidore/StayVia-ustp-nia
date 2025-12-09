import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { paymentService } from '@/services/paymentService';
import { PaymentCalendarView } from '@/components/PaymentCalendarView';

export default function PaymentCalendarPage() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = useSupabase();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const userId = user?.id;
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Fetch ALL payments (not filtered by month - we filter on client side)
  const { data: allPayments = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ['payments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const result = await paymentService.getPaymentsByLandlord(
        userId,
        undefined,
        undefined,
        supabase
      );
      console.log('All payments fetched:', result.length);
      return result;
    },
    enabled: !!userId,
  });

  // Filter payments by current month for display
  const payments = useMemo(() => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    return allPayments.filter((payment: any) => {
      const paymentDate = new Date(payment.due_date);
      return paymentDate >= startDate && paymentDate <= endDate;
    });
  }, [allPayments, month, year]);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['paymentStats', userId],
    queryFn: async () => {
      if (!userId) return null;
      return paymentService.getPaymentStats(userId, supabase);
    },
    enabled: !!userId,
  });

  // Get unique tenants for filtering
  const tenants = useMemo(() => {
    const uniqueTenants = Array.from(
      new Map(allPayments.map((p: any) => [p.tenant_id, p.tenant])).values()
    );
    return uniqueTenants;
  }, [allPayments]);

  // Filter payments by tenant
  const filteredPayments = useMemo(() => {
    let filtered = payments;
    if (selectedTenant) {
      filtered = filtered.filter((p: any) => p.tenant_id === selectedTenant);
    }
    if (selectedDate && viewMode === 'calendar') {
      const dateStr = selectedDate.toISOString().split('T')[0];
      filtered = filtered.filter((p: any) => {
        const dueStr = p.due_date.split('T')[0];
        return dueStr === dateStr;
      });
    }
    return filtered;
  }, [payments, selectedTenant, selectedDate, viewMode]);

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPayment?.id) throw new Error('No payment selected');
      return paymentService.updatePaymentStatus(
        selectedPayment.id,
        paymentStatus || selectedPayment.status,
        paymentStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
        notes || selectedPayment.notes,
        paymentMethod || selectedPayment.payment_method,
        supabase
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', userId] });
      queryClient.invalidateQueries({ queryKey: ['paymentStats', userId] });
      setShowPaymentModal(false);
      Alert.alert('Success', 'Payment updated successfully');
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to update payment');
      console.error('Error updating payment:', error);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['payments', userId] });
    await queryClient.refetchQueries({ queryKey: ['paymentStats', userId] });
    setRefreshing(false);
  };

  // Refresh when page comes into focus
  useFocusEffect(
    React.useCallback(() => {
      onRefresh();
    }, [userId])
  );

  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
    setSelectedTenant(null);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
    setSelectedTenant(null);
    setSelectedDate(null);
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10B981';
      case 'overdue':
        return '#F59E0B';
      case 'unpaid':
        return '#EF4444';
      case 'partial':
        return '#8B5CF6';
      case 'cancelled':
        return '#9CA3AF';
      default:
        return colors.border;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return 'checkmark-circle';
      case 'overdue':
        return 'alert-circle';
      case 'unpaid':
        return 'close-circle';
      case 'partial':
        return 'help-circle';
      default:
        return 'ellipsis-horizontal-circle';
    }
  };

  const openPaymentModal = (payment: any) => {
    setSelectedPayment(payment);
    setPaymentStatus(payment.status);
    setPaymentMethod(payment.payment_method || '');
    setNotes(payment.notes || '');
    setShowPaymentModal(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date set';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (isLoadingPayments && !refreshing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        className="px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View className="mb-6 mt-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-3xl font-bold" style={{ color: colors.foreground }}>
              💰 Payment Schedule
            </Text>
            <Text className="mt-1 text-sm text-gray-500">Track tenant payments</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Stats Cards */}
        <View className="mb-6 gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-lg p-4" style={{ backgroundColor: '#10B981' }}>
              <Text className="text-xs text-green-100">Paid</Text>
              <Text className="text-2xl font-bold text-white">
                ₱{(stats?.total_paid || 0).toLocaleString()}
              </Text>
              <Text className="text-xs text-green-100">{stats?.paid_count || 0} payments</Text>
            </View>

            <View className="flex-1 rounded-lg p-4" style={{ backgroundColor: '#EF4444' }}>
              <Text className="text-xs text-red-100">Unpaid</Text>
              <Text className="text-2xl font-bold text-white">
                ₱{(stats?.total_due || 0).toLocaleString()}
              </Text>
              <Text className="text-xs text-red-100">{stats?.unpaid_count || 0} payments</Text>
            </View>

            <View className="flex-1 rounded-lg p-4" style={{ backgroundColor: '#F59E0B' }}>
              <Text className="text-xs text-yellow-100">Overdue</Text>
              <Text className="text-2xl font-bold text-white">
                ₱{(stats?.total_overdue || 0).toLocaleString()}
              </Text>
              <Text className="text-xs text-yellow-100">{stats?.overdue_count || 0} payments</Text>
            </View>
          </View>
        </View>

        {/* Month Navigation */}
        <View
          className="mb-6 flex-row items-center justify-between rounded-lg border p-4"
          style={{ borderColor: colors.border }}>
          <TouchableOpacity onPress={goToPreviousMonth} className="p-2">
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
            {monthName}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} className="p-2">
            <Ionicons name="chevron-forward" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* View Mode Toggle */}
        <View className="mb-6 flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              setViewMode('calendar');
              setSelectedDate(null);
            }}
            className={`flex-1 rounded-lg py-3 ${
              viewMode === 'calendar' ? 'bg-blue-600' : 'border'
            }`}
            style={viewMode !== 'calendar' ? { borderColor: colors.border } : undefined}>
            <View className="flex-row items-center justify-center gap-2">
              <Ionicons
                name="calendar"
                size={18}
                color={viewMode === 'calendar' ? '#fff' : colors.foreground}
              />
              <Text
                className="font-semibold"
                style={{ color: viewMode === 'calendar' ? '#fff' : colors.foreground }}>
                Calendar
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setViewMode('list');
              setSelectedDate(null);
            }}
            className={`flex-1 rounded-lg py-3 ${viewMode === 'list' ? 'bg-blue-600' : 'border'}`}
            style={viewMode !== 'list' ? { borderColor: colors.border } : undefined}>
            <View className="flex-row items-center justify-center gap-2">
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? '#fff' : colors.foreground}
              />
              <Text
                className="font-semibold"
                style={{ color: viewMode === 'list' ? '#fff' : colors.foreground }}>
                List
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <PaymentCalendarView
            payments={allPayments as any}
            currentDate={currentDate}
            onDateSelected={(date) => setSelectedDate(date)}
            onPaymentSelected={(payment) => openPaymentModal(payment)}
            colors={colors}
          />
        )}

        {/* Tenant Filter Tabs */}
        {tenants.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setSelectedTenant(null)}
              className={`rounded-full px-4 py-2 ${
                selectedTenant === null ? 'bg-blue-600' : 'border bg-transparent'
              }`}
              style={
                selectedTenant !== null
                  ? { borderColor: colors.border, backgroundColor: colors.card }
                  : undefined
              }>
              <Text
                className="font-semibold"
                style={{ color: selectedTenant === null ? '#fff' : colors.foreground }}>
                All ({allPayments.length})
              </Text>
            </TouchableOpacity>

            {tenants.map((tenant: any) => {
              const tenantPayments = allPayments.filter((p: any) => p.tenant_id === tenant.id);
              return (
                <TouchableOpacity
                  key={tenant.id}
                  onPress={() => setSelectedTenant(tenant.id)}
                  className={`rounded-full px-4 py-2 ${
                    selectedTenant === tenant.id ? 'bg-blue-600' : 'border bg-transparent'
                  }`}
                  style={
                    selectedTenant !== tenant.id
                      ? { borderColor: colors.border, backgroundColor: colors.card }
                      : undefined
                  }>
                  <Text
                    className="font-semibold"
                    style={{ color: selectedTenant === tenant.id ? '#fff' : colors.foreground }}>
                    {tenant.firstname} ({tenantPayments.length})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Payments List */}
        <View>
          <Text className="mb-4 text-lg font-bold" style={{ color: colors.foreground }}>
            {viewMode === 'calendar' && selectedDate
              ? `Payments on ${formatDate(selectedDate.toISOString())} (${filteredPayments.length})`
              : `Payments ${viewMode === 'calendar' ? 'This Month' : ''} (${filteredPayments.length})`}
          </Text>

          {filteredPayments.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons name="calendar-outline" size={48} color={colors.foreground} />
              <Text className="mt-4 text-center text-gray-500">
                {viewMode === 'calendar' && selectedDate
                  ? 'No payments for this date'
                  : 'No payments for this period'}
              </Text>
              {allPayments.length > 0 && (
                <Text className="mt-2 text-center text-sm text-gray-400">
                  Found {allPayments.length} total payments but none match current filters
                </Text>
              )}
            </View>
          ) : (
            <View className="gap-3">
              {filteredPayments.map((payment: any) => {
                // Debug logging for first payment
                if (filteredPayments.indexOf(payment) === 0) {
                  console.log('Payment data:', payment);
                  console.log('Due date:', payment.due_date);
                  console.log('Formatted due date:', formatDate(payment.due_date));
                }
                return (
                  <TouchableOpacity
                    key={payment.id}
                    onPress={() => openPaymentModal(payment)}
                    className="flex-row items-center gap-3 rounded-lg border p-4"
                    style={{ borderColor: colors.border, backgroundColor: colors.card }}>
                    {/* Status Icon */}
                    <View
                      className="items-center justify-center rounded-full p-2"
                      style={{ backgroundColor: getPaymentColor(payment.status) }}>
                      <Ionicons name={getStatusIcon(payment.status)} size={20} color="#fff" />
                    </View>

                    {/* Payment Info */}
                    <View className="flex-1">
                      <Text className="font-semibold" style={{ color: colors.foreground }}>
                        {payment.tenant?.firstname} {payment.tenant?.lastname}
                      </Text>
                      <Text className="text-xs text-gray-500">{payment.post?.title}</Text>
                      <Text className="mt-1 text-sm" style={{ color: colors.foreground }}>
                        Due: {formatDate(payment.due_date)}
                      </Text>
                    </View>

                    {/* Amount and Status */}
                    <View className="items-end">
                      <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                        ₱{payment.amount?.toLocaleString()}
                      </Text>
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: getPaymentColor(payment.status) }}>
                        {payment.status?.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Payment Details Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}>
        <View className="flex-1 bg-black/50">
          <View
            className="absolute bottom-0 w-full rounded-t-2xl p-6"
            style={{ backgroundColor: colors.card }}>
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold" style={{ color: colors.foreground }}>
                Payment Details
              </Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-4 max-h-96">
              {/* Tenant Info */}
              <View className="mb-4 rounded-lg border p-3" style={{ borderColor: colors.border }}>
                <Text className="text-xs text-gray-500">Tenant</Text>
                <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                  {selectedPayment?.tenant?.firstname} {selectedPayment?.tenant?.lastname}
                </Text>
              </View>

              {/* Property Info */}
              <View className="mb-4 rounded-lg border p-3" style={{ borderColor: colors.border }}>
                <Text className="text-xs text-gray-500">Property</Text>
                <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                  {selectedPayment?.post?.title}
                </Text>
              </View>

              {/* Amount */}
              <View className="mb-4 rounded-lg border p-3" style={{ borderColor: colors.border }}>
                <Text className="text-xs text-gray-500">Amount</Text>
                <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>
                  ₱{selectedPayment?.amount?.toLocaleString()}
                </Text>
              </View>

              {/* Due Date */}
              <View className="mb-4 rounded-lg border p-3" style={{ borderColor: colors.border }}>
                <Text className="text-xs text-gray-500">Due Date</Text>
                <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                  {formatDate(selectedPayment?.due_date)}
                </Text>
              </View>

              {/* Status Dropdown */}
              <View className="mb-4">
                <Text className="mb-2 text-xs text-gray-500">Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                  {['unpaid', 'paid', 'partial', 'overdue', 'cancelled'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setPaymentStatus(status)}
                      className={`rounded-full px-4 py-2 ${
                        paymentStatus === status ? 'opacity-100' : 'opacity-50'
                      }`}
                      style={{
                        backgroundColor: getPaymentColor(status),
                      }}>
                      <Text className="font-semibold capitalize text-white">{status}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Payment Method */}
              <View className="mb-4">
                <Text className="mb-2 text-xs text-gray-500">Payment Method</Text>
                <TextInput
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  placeholder="e.g., Bank Transfer, Cash, Check"
                  placeholderTextColor="#999"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
              </View>

              {/* Notes */}
              <View className="mb-4">
                <Text className="mb-2 text-xs text-gray-500">Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any notes..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowPaymentModal(false)}
                className="flex-1 rounded-lg border py-3"
                style={{ borderColor: colors.border }}>
                <Text className="text-center font-semibold" style={{ color: colors.foreground }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updatePaymentMutation.mutate()}
                disabled={updatePaymentMutation.isPending}
                className={`flex-1 rounded-lg py-3 ${
                  updatePaymentMutation.isPending ? 'bg-gray-400' : 'bg-blue-600'
                }`}>
                <Text className="text-center font-semibold text-white">
                  {updatePaymentMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
