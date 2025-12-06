import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMessages,
  Message,
  sendMessage,
  subscribeToMessages,
} from '@/services/conversationService';
import { getUserById } from '@/services/userService';
import MessageList from '@/components/MessageList';
import DownloadImage from '@/components/download/downloadImage';
import { Ionicons } from '@expo/vector-icons';

export default function ConversationPage() {
  const { id: conversationId, otherUserId } = useLocalSearchParams<{
    id: string;
    otherUserId?: string;
  }>();
  const supabase = useSupabase();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [newMessage, setNewMessage] = useState('');

  // 🧑 Fetch other user's data
  const { data: otherUser } = useQuery({
    queryKey: ['user', otherUserId],
    queryFn: () => getUserById(otherUserId!, supabase),
    enabled: !!otherUserId,
  });

  // 🧠 Fetch all messages for this conversation
  const {
    data: messages = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(supabase, conversationId),
    enabled: !!conversationId,
  });

  // 👥 Create a senders map for the MessageList component
  const sendersMap = React.useMemo(() => {
    if (!otherUser) return {};
    return {
      [otherUserId!]: otherUser,
    };
  }, [otherUser, otherUserId]);

  // 📨 Send message mutation
  const { mutate: handleSendMessage, isPending: sending } = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newMessage.trim()) return;
      await sendMessage(supabase, conversationId, user.id, newMessage.trim());
      setNewMessage('');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  // 🔁 Subscribe to new messages in realtime
  useEffect(() => {
    if (!conversationId) return;

    const subscription = subscribeToMessages(supabase, conversationId, (msg) => {
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old = []) => [
        ...old,
        msg,
      ]);
    });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId]);

  if (isLoading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );

  if (error)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text>Error loading messages</Text>
      </View>
    );

  const defaultAvatar = 'https://i.pravatar.cc/150';
  const otherUserName = otherUser
    ? `${otherUser.firstname || ''} ${otherUser.lastname || ''}`.trim() ||
      otherUser.username ||
      'User'
    : 'User';

  const headerBgColor = isDark ? '#1f2937' : '#f9fafb';
  const headerTextColor = isDark ? '#ffffff' : '#000000';
  const headerIconColor = isDark ? '#ffffff' : '#1f2937';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        {/* Header with back button, avatar, and name */}
        <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={headerIconColor} />
          </TouchableOpacity>
          <DownloadImage
            path={otherUser?.avatar || ''}
            supabase={supabase}
            fallbackUri={defaultAvatar}
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
          />
          <Text
            className="font-semibold"
            style={{
              color: headerTextColor,
              fontSize: 18,
              fontWeight: '600',
              flex: 1,
            }}
            numberOfLines={1}>
            {otherUserName}
          </Text>
        </View>

        <SafeAreaView edges={['bottom']} className="flex-1">
          {/* Message list */}
          <MessageList messages={messages} currentUserId={user?.id} sendersMap={sendersMap} />

          {/* Input box */}
          <View className="flex-row items-center border-t border-gray-300 px-3 pt-3 pb-1">
            <TextInput
              className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-base"
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
            />
            <TouchableOpacity
              onPress={() => handleSendMessage()}
              disabled={!newMessage.trim() || sending}
              className={`ml-2 rounded-full px-4 py-2 ${
                sending || !newMessage.trim() ? 'bg-gray-400' : 'bg-blue-500'
              }`}>
              <Text className="font-semibold text-white">{sending ? '...' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
