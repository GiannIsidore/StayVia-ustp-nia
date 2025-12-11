import React, { useMemo, useState, useCallback } from 'react'; // 🚨 Added useCallback
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  useColorScheme,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import DownloadImage from '@/components/download/downloadImage';
import { getOrCreateConversation } from '@/services/conversationService';
import {
  deleteRequest,
  fetchAllRequests,
  updateRequest,
  fetchRequestsByUser,
  fetchAllVerificationMessages,
} from '@/services/requestService';
import { useRouter } from 'expo-router';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { DatePickerInput } from '@/components/ui/date-picker-input';

// Define the type for the verification notification for easier merging
type VerificationNotification = {
  id: string;
  type: 'verification' | 'pending_verification' | 'verification_success';
  title: string;
  reject_msg: string | null;
  created_at: string | null | undefined;
  time: string;
  avatar: string;
};

// Define a unified type for all notifications
type NotificationItem = any | VerificationNotification;

export default function NotificationIndex() {
  const router = useRouter();
  const { user } = useUser();
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Approval modal state
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<any>(null);
  const [approvalStartDate, setApprovalStartDate] = useState<Date>(new Date());
  const [approvalEndDate, setApprovalEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  });
  const [approvalPaymentDay, setApprovalPaymentDay] = useState('1');

  const defaultAvatar = 'https://i.pravatar.cc/150';
  const avatarUrl =
    !user?.imageUrl || user.imageUrl.includes('clerk.dev/static') ? defaultAvatar : user.imageUrl;

  // ------------------ 1. Fetch User's Account Type and Dates ------------------
  const {
    data: userData,
    isLoading: isUserLoading,
    refetch: refetchUserData,
    isRefetching: isRefetchingUserData,
  } = useQuery({
    // 🚨 Added refetch and isRefetching
    queryKey: ['currentUser', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('users')
        .select('account_type, created_at, verified_at')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // ------------------ 2. Fetch Verification Messages (Rejected History) ------------------
  const {
    data: verificationMessages = [],
    refetch: refetchVerificationMessages,
    isRefetching: isRefetchingVerificationMessages,
  } = useQuery({
    // 🚨 Added refetch and isRefetching
    queryKey: ['verificationMessages', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchAllVerificationMessages(user.id, supabase);
    },
    enabled: !!user?.id,
  });

  // ------------------ Existing Request Fetches ------------------
  const {
    data: myPosts = [],
    refetch: refetchMyPosts,
    isRefetching: isRefetchingMyPosts,
  } = useQuery({
    // 🚨 Added refetch and isRefetching
    queryKey: ['myPosts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('posts').select('*').eq('user_id', user.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const postIds = useMemo(() => myPosts.map((p) => p.id), [myPosts]);

  // Requests to my posts
  const {
    data: postOwnerRequests = [],
    refetch: refetchPostOwnerRequests,
    isRefetching: isRefetchingPostOwnerRequests,
  } = useQuery({
    // 🚨 Added refetch and isRefetching
    queryKey: ['requestsToMyPosts', postIds],
    queryFn: async () => (postIds.length ? fetchAllRequests(postIds, supabase) : []),
    enabled: !!postIds.length,
  });

  // Requests I sent
  const {
    data: myRequests = [],
    refetch: refetchMyRequests,
    isRefetching: isRefetchingMyRequests,
  } = useQuery({
    // 🚨 Added refetch and isRefetching
    queryKey: ['myRequests', user?.id],
    queryFn: async () => (user ? fetchRequestsByUser(user.id, supabase) : []),
    enabled: !!user,
  });

  // Rentals due for rating
  const {
    data: rentalsDueForRating = [],
    refetch: refetchRentalsDueForRating,
    isRefetching: isRefetchingRentalsDueForRating,
  } = useQuery({
    queryKey: ['rentalsDueForRating', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('requests')
        .select(
          `
                     id,
                     rental_start_date,
                     rental_end_date,
                     monthly_rent_amount,
                     created_at,
                     posts(id, title, user_id, post_user:users(id, firstname, lastname, avatar)),
                     rater:users(id, firstname, lastname, avatar)
                 `
        )
        .eq('user_id', user.id)
        .eq('confirmed', true)
        .is('rating_notif_sent', null)
        .not('rental_start_date', 'is', null)
        .lte('rental_start_date', sevenDaysAgo.toISOString());

      if (error) {
        console.error('Error fetching rentals due for rating:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ------------------ PULL-TO-REFRESH LOGIC ------------------

  // Determine if any query is currently refetching
  const isAnyRefetching =
    isRefetchingUserData ||
    isRefetchingVerificationMessages ||
    isRefetchingMyPosts ||
    isRefetchingPostOwnerRequests ||
    isRefetchingMyRequests;

  // Function to trigger refetching for all queries
  const handleRefresh = useCallback(async () => {
    // Use Promise.all to wait for all refetches to complete concurrently
    await Promise.all([
      refetchUserData(),
      refetchVerificationMessages(),
      refetchMyPosts(),
      refetchPostOwnerRequests(),
      refetchMyRequests(),
    ]);
  }, [
    refetchUserData,
    refetchVerificationMessages,
    refetchMyPosts,
    refetchPostOwnerRequests,
    refetchMyRequests,
  ]);

  // ------------------ 3. Combine ALL notifications ------------------
  const notifications: NotificationItem[] = useMemo(() => {
    let combined: NotificationItem[] = [...postOwnerRequests, ...myRequests];

    const accountType = userData?.account_type;

    // 🟢 Landlord Verified (Success) Notification
    if (accountType === 'landlord' && userData?.verified_at) {
      // Only show success if verified_at exists
      const verifiedDate = new Date(userData.verified_at);

      const successNotif: VerificationNotification = {
        id: `verification-success-${userData.verified_at}`,
        type: 'verification_success',
        title: 'Account Verification Successful! 🎉',
        reject_msg: 'The administrator has reviewed and approved your landlord account.',
        created_at: userData.verified_at,
        time: formatDistanceToNow(verifiedDate, { addSuffix: true }),
        avatar: 'system',
      };
      combined.push(successNotif);
    }

    // 🟠 Landlord Unverified (Pending) Notification
    if (accountType === 'landlord_unverified') {
      const createdDate = userData?.created_at ? new Date(userData.created_at) : new Date();

      const pendingNotif: VerificationNotification = {
        id: `pending-verification-${userData?.created_at}`,
        type: 'pending_verification',
        title: 'Verification Pending',
        reject_msg: 'Your landlord proof is currently under administrator review.',
        created_at: userData?.created_at,
        time: formatDistanceToNow(createdDate, { addSuffix: true }),
        avatar: 'system',
      };
      combined.push(pendingNotif);
    }

    // 🔴 Rejected Verification Notifications (History)
    verificationMessages.forEach((msg, index) => {
      const rejectionNotif: VerificationNotification = {
        id: `verification-reject-${msg.created_at}-${index}`,
        type: 'verification',
        title: 'Admin Notification: Account Verification Update',
        reject_msg: msg.reject_msg,
        created_at: msg.created_at,
        time: msg.time,
        avatar: 'system',
      };
      combined.push(rejectionNotif);
    });

    // 🚨 FINAL SORT: Sort all notifications by created_at (newest first)
    return combined.sort((a, b) => {
      const dateA =
        a.created_at !== null && a.created_at !== undefined
          ? new Date(a.created_at).getTime()
          : (a as any).post?.created_at
            ? new Date((a as any).post.created_at).getTime()
            : 0;
      const dateB =
        b.created_at !== null && b.created_at !== undefined
          ? new Date(b.created_at).getTime()
          : (b as any).post?.created_at
            ? new Date((b as any).post.created_at).getTime()
            : 0;

      return dateB - dateA;
    });
  }, [postOwnerRequests, myRequests, verificationMessages, userData]);

  // ------------------ Mutations (omitted for brevity) ------------------
  const { mutate: startChat } = useMutation({
    mutationFn: (selectedUser: any) => getOrCreateConversation(supabase, user!.id, selectedUser.id),
    onSuccess: (conversation, selectedUser: any) => {
      router.push(
        `/(channel)/${conversation.id}?name=${selectedUser.firstname}&avatar=${selectedUser.avatar ?? ''}`
      );
    },
    onError: () => Alert.alert('Error', 'Failed to start chat.'),
  });

  const deleteNotifMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRequestId) throw new Error('No request selected');
      return deleteRequest(selectedRequestId, supabase);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requestsToMyPosts'] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      setConfirmVisible(false);
      setSelectedRequestId(null);
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      startDate,
      endDate,
      paymentDay,
    }: {
      requestId: string;
      startDate?: Date;
      endDate?: Date;
      paymentDay?: number;
    }) => updateRequest(requestId, supabase, startDate, endDate, paymentDay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requestsToMyPosts'] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
      setApprovalModalVisible(false);
    },
    onError: (error: any) => {
      // Handle occupancy limit errors specifically
      const errorMsg = error.message || error.toString();

      if (errorMsg.includes('maximum occupancy') || errorMsg.includes('fully occupied')) {
        Alert.alert(
          'Cannot Start Rental',
          'This property is at maximum occupancy. All available slots are currently filled.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to approve request. Please try again.');
      }

      // Refresh to show current state
      queryClient.invalidateQueries({ queryKey: ['requestsToMyPosts'] });
      queryClient.invalidateQueries({ queryKey: ['myRequests'] });
    },
  });

  const handleApprove = (item: any) => {
    // If not requested yet → just acknowledge (no dates needed)
    if (!item.requested) {
      approveRequestMutation.mutate({
        requestId: item.id,
        startDate: undefined,
        endDate: undefined,
        paymentDay: undefined,
      });
    } else {
      // If approving (requested=true, confirmed=false) → show date modal
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      setSelectedRequestForApproval(item);
      setApprovalStartDate(today);
      setApprovalEndDate(nextMonth);
      setApprovalPaymentDay('1');
      setApprovalModalVisible(true);
    }
  };
  const handleDelete = (id: string) => {
    setSelectedRequestId(id);
    setConfirmVisible(true);
  };
  const confirmDelete = () => deleteNotifMutation.mutate();
  const handleOpenPost = (id: string) => router.push(`/(post)/${id}`);

  if (isUserLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? '#121212' : '#f5f5f5',
        }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // ------------------ 4. Render Notification ------------------
  const renderNotification = ({ item }: { item: NotificationItem }) => {
    // 🟢 Handle Success Verification Notification (Green)
    if (item.type === 'verification_success') {
      const vItem = item as VerificationNotification;
      return (
        <View
          key={vItem.id}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            padding: 12,
            marginHorizontal: 12,
            marginVertical: 6,
            borderRadius: 12,
            backgroundColor: isDark ? '#1e3b2e' : '#e6fbf2', // Green background for success
            borderLeftWidth: 4,
            borderLeftColor: isDark ? '#4caf50' : '#4caf50',
            elevation: 2,
          }}>
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={isDark ? '#4caf50' : '#4caf50'}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: isDark ? '#fff' : '#000' }}>
              {vItem.title}
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#aaa' : '#555', marginTop: 2 }}>
              {vItem.reject_msg}
            </Text>
            <Text style={{ fontSize: 10, color: isDark ? '#777' : '#888', marginTop: 4 }}>
              Verified {vItem.time}
            </Text>
          </View>
        </View>
      );
    }

    // 🟠 Handle Pending Verification Notification (Orange/Yellow)
    if (item.type === 'pending_verification') {
      const vItem = item as VerificationNotification;
      return (
        <View
          key={vItem.id}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            padding: 12,
            marginHorizontal: 12,
            marginVertical: 6,
            borderRadius: 12,
            backgroundColor: isDark ? '#3b3b1e' : '#fbf2e6',
            borderLeftWidth: 4,
            borderLeftColor: isDark ? '#ff9800' : '#ff9800',
            elevation: 2,
          }}>
          <Ionicons
            name="time"
            size={24}
            color={isDark ? '#ff9800' : '#ff9800'}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: isDark ? '#fff' : '#000' }}>
              {vItem.title}
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#aaa' : '#555', marginTop: 2 }}>
              {vItem.reject_msg}
            </Text>
            <Text style={{ fontSize: 10, color: isDark ? '#777' : '#888', marginTop: 4 }}>
              Submitted {vItem.time}
            </Text>
          </View>
        </View>
      );
    }

    // 🔵 HANDLE REJECTED VERIFICATION NOTIFICATION (Blue/Gray)
    if (item.type === 'verification') {
      const vItem = item as VerificationNotification;
      return (
        <View
          key={vItem.id}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            padding: 12,
            marginHorizontal: 12,
            marginVertical: 6,
            borderRadius: 12,
            backgroundColor: isDark ? '#292e44' : '#e6eaf8',
            borderLeftWidth: 4,
            borderLeftColor: isDark ? '#667EEA' : '#667EEA',
            elevation: 2,
          }}>
          <Ionicons
            name="information-circle"
            size={24}
            color={isDark ? '#667EEA' : '#667EEA'}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: isDark ? '#fff' : '#000' }}>
              {vItem.title}
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#aaa' : '#555', marginTop: 2 }}>
              {vItem.reject_msg ||
                'No specific reason provided. Please update your profile proofs.'}
            </Text>
            <Text style={{ fontSize: 10, color: isDark ? '#777' : '#888', marginTop: 4 }}>
              Received {vItem.time}
            </Text>
          </View>
        </View>
      );
    }

    // 📝 EXISTING REQUEST NOTIFICATION LOGIC
    const isPostOwner = item.post.user_id === user?.id;
    const isRequestOwner = item.user.id === user?.id;

    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => handleOpenPost(item.postId)}
        activeOpacity={0.8}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            padding: 12,
            marginHorizontal: 12,
            marginVertical: 6,
            borderRadius: 12,
            backgroundColor: isDark ? '#1f1f1f' : '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}>
          <DownloadImage
            path={item.avatar}
            supabase={supabase}
            fallbackUri={avatarUrl}
            style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
          />

          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', fontSize: 14, color: isDark ? '#fff' : '#000' }}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#aaa' : '#555', marginTop: 2 }}>
              {item.time}
            </Text>

            {/* Status badge */}
            {(isRequestOwner || isPostOwner) && (item.requested || item.confirmed) && (
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 4,
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    backgroundColor: item.confirmed ? '#4caf50' : '#ff9800',
                    alignSelf: 'flex-start',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                  }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '500' }}>
                    {item.confirmed ? 'Started' : 'Inquired'}
                  </Text>
                </View>

                {/* Show dates if confirmed and viewing as student */}
                {item.confirmed &&
                  isRequestOwner &&
                  item.rental_start_date &&
                  item.rental_end_date && (
                    <Text style={{ fontSize: 10, color: isDark ? '#aaa' : '#555' }}>
                      📅{' '}
                      {new Date(item.rental_start_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      -{' '}
                      {new Date(item.rental_end_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  )}
              </View>
            )}

            {/* Action buttons (only for post owner) */}
            {isPostOwner && (
              <View style={{ flexDirection: 'row', marginTop: 6, gap: 8 }}>
                {!item.requested && (
                  <TouchableOpacity
                    onPress={() => handleApprove(item)}
                    style={{
                      backgroundColor: '#ff9800',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Inquire</Text>
                  </TouchableOpacity>
                )}
                {item.requested && !item.confirmed && (
                  <TouchableOpacity
                    onPress={() => handleApprove(item)}
                    style={{
                      backgroundColor: '#667EEA',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>
                      Start Rental
                    </Text>
                  </TouchableOpacity>
                )}
                {item.confirmed && (
                  <View
                    style={{
                      backgroundColor: '#4caf50',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Started</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={{
                    backgroundColor: '#e53935',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '500' }}>Disapprove</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => startChat(item.user)}
                  style={{ paddingVertical: 6, borderRadius: 8 }}>
                  <Ionicons name="chatbubble" size={18} color="gray" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#f5f5f5' }}
      edges={['top', 'left', 'right']}>
      <View
        style={{
          backgroundColor: isDark ? '#1f1f1f' : '#fff',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#333' : '#ddd',
          paddingVertical: 16,
          paddingHorizontal: 16,
        }}>
        <Text
          style={{
            color: isDark ? '#fff' : '#000',
            fontSize: 20,
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
          Notifications
        </Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={{ paddingVertical: 8 }}
        // 🚨 ADD PULL-TO-REFRESH PROPS HERE
        onRefresh={handleRefresh}
        refreshing={isAnyRefetching}
      />

      <AlertDialog
        visible={confirmVisible}
        title="Delete Request"
        message="Are you sure you want to disapprove this request?"
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />

      {/* Approval Date Modal */}
      <Modal
        visible={approvalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setApprovalModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              backgroundColor: isDark ? '#1f1f1f' : '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 24,
            }}>
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: isDark ? '#fff' : '#000' }}>
                Start Rental
              </Text>
              <TouchableOpacity onPress={() => setApprovalModalVisible(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400, marginBottom: 16 }}>
              {/* Student & Property Info */}
              <View
                style={{
                  marginBottom: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#ddd',
                  padding: 12,
                }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#fff' : '#000' }}>
                  {selectedRequestForApproval?.user?.firstname}{' '}
                  {selectedRequestForApproval?.user?.lastname}
                </Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {selectedRequestForApproval?.post?.title}
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#000',
                    marginTop: 8,
                  }}>
                  ₱{selectedRequestForApproval?.post?.price_per_night?.toLocaleString()}/month
                </Text>
              </View>

              {/* Start Date */}
              <DatePickerInput
                label="Move-in Date (Start Date)"
                value={approvalStartDate}
                onChange={setApprovalStartDate}
                textColor={isDark ? '#fff' : '#000'}
                borderColor={isDark ? '#333' : '#ddd'}
                backgroundColor={isDark ? '#2a2a2a' : '#f5f5f5'}
              />

              {/* End Date */}
              <DatePickerInput
                label="Lease End Date"
                value={approvalEndDate}
                onChange={setApprovalEndDate}
                minimumDate={approvalStartDate}
                textColor={isDark ? '#fff' : '#000'}
                borderColor={isDark ? '#333' : '#ddd'}
                backgroundColor={isDark ? '#2a2a2a' : '#f5f5f5'}
              />

              {/* Payment Day */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#fff' : '#000',
                    marginBottom: 8,
                  }}>
                  Payment Day of Month (1-31)
                </Text>
                <TextInput
                  value={approvalPaymentDay}
                  onChangeText={setApprovalPaymentDay}
                  placeholder="1"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={2}
                  style={{
                    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                    color: isDark ? '#fff' : '#000',
                    borderColor: isDark ? '#333' : '#ddd',
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 10,
                  }}
                />
              </View>

              {/* Info Box */}
              <View
                style={{
                  borderRadius: 8,
                  backgroundColor: isDark ? '#1e3a5f' : '#e6f2ff',
                  padding: 12,
                }}>
                <Text style={{ fontSize: 12, color: isDark ? '#aac8e4' : '#2563eb' }}>
                  💡 Monthly rent will be set to ₱
                  {selectedRequestForApproval?.post?.price_per_night?.toLocaleString()} and payment
                  reminders will be created based on these dates.
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setApprovalModalVisible(false)}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#ddd',
                  paddingVertical: 12,
                }}>
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '600',
                    color: isDark ? '#fff' : '#000',
                  }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  // Validate dates (already Date objects)
                  const paymentDay = parseInt(approvalPaymentDay) || 1;

                  if (approvalEndDate <= approvalStartDate) {
                    Alert.alert('Invalid Dates', 'End date must be after start date');
                    return;
                  }
                  if (paymentDay < 1 || paymentDay > 31) {
                    Alert.alert('Invalid Payment Day', 'Payment day must be between 1-31');
                    return;
                  }

                  approveRequestMutation.mutate({
                    requestId: selectedRequestForApproval.id,
                    startDate: approvalStartDate,
                    endDate: approvalEndDate,
                    paymentDay: paymentDay,
                  });
                }}
                disabled={approveRequestMutation.isPending}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  paddingVertical: 12,
                  backgroundColor: approveRequestMutation.isPending ? '#9ca3af' : '#2563eb',
                }}>
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#fff',
                  }}>
                  {approveRequestMutation.isPending ? 'Starting...' : 'Start Rental'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
