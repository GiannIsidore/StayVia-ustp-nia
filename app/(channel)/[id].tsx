import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';
import { subscribeToMessages, Message } from '@/services/conversationService';
import DownloadImage from '@/components/download/downloadImage';

import { Ionicons } from '@expo/vector-icons';

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();
  const { channelData } = useLocalSearchParams<{ channelData: string }>();
  const channel = channelData ? JSON.parse(channelData) : null;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [sendersMap, setSendersMap] = useState<Record<string, any>>({});
  const params = useLocalSearchParams();
  const otherUserName = params.name;
  const otherUserAvatar = params.avatar ?? '';

  const defaultAvatar = 'https://i.pravatar.cc/150';
  const avatarUrl =
    !user?.imageUrl || user.imageUrl.includes('clerk.dev/static') ? defaultAvatar : user.imageUrl;

  const headerTextColor = isDark ? '#ffffff' : '#000000';
  const headerIconColor = isDark ? '#ffffff' : '#1f2937';

  useEffect(() => {
    if (!id || !user) return;

    fetchConversation();
    fetchMessages();

    // Fetch other user info if not provided in query params
    if (!otherUserName || !otherUserAvatar) {
      fetchOtherUser();
    }

    // Subscribe for live updates
    const subscription = subscribeToMessages(supabase, id, (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev; // prevent duplicates
        return [...prev, msg];
      });
    });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id, user]);

  const fetchConversation = async () => {
    const { data, error } = await supabase.from('conversations').select('*').eq('id', id).single();

    if (error) {
      console.error('Error fetching conversation:', error.message);
      return;
    }

    setConversation(data);
  };

  const fetchMessages = async () => {
    console.log('Fetching messages for conversation:', id);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error.message);
    } else {
      console.log('Fetched messages:', data?.length || 0);
      console.log('Messages data:', data);

      setMessages(data || []);
      // Fetch user info for all unique senders
      if (data && data.length > 0) {
        fetchSendersInfo(data);
      } else {
        console.log('No messages to fetch sender info for');
      }
    }

    setLoading(false);
  };

  const fetchSendersInfo = async (messagesList: Message[]) => {
    if (!messagesList || messagesList.length === 0) return;

    // Get unique sender IDs
    const uniqueSenderIds = Array.from(
      new Set(messagesList.map((msg) => msg.sender_id).filter(Boolean))
    ) as string[];

    if (uniqueSenderIds.length === 0) return;

    try {
      // Fetch user info for all senders
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', uniqueSenderIds);

      if (usersError) {
        console.error('Error fetching senders:', usersError.message);
        return;
      }

      // Create a map of sender ID to user info
      const map: Record<string, any> = {};
      users?.forEach((user) => {
        if (user.id) {
          map[user.id] = user;
        }
      });

      console.log('Fetched senders map:', map);
      console.log('Unique sender IDs:', uniqueSenderIds);
      console.log('Fetched users:', users);

      setSendersMap(map);
    } catch (error) {
      console.error('Error creating senders map:', error);
    }
  };

  const fetchOtherUser = async () => {
    if (!id || !user?.id) return;

    try {
      // Fetch all participants in this conversation
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id, users!conversation_participants_user_id_fkey(*)')
        .eq('conversation_id', id);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError.message);
        return;
      }

      // Find the other user (not the current user)
      const otherParticipant = participants?.find((p: any) => p.user_id !== user.id);

      if (otherParticipant?.users) {
        setOtherUser(otherParticipant.users);
      }
    } catch (error) {
      console.error('Error fetching other user:', error);
    }
  };

  const handleNewMessage = async (msg: Message) => {
    console.log('New message received:', msg);

    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev; // prevent duplicates
      return [...prev, msg];
    });

    // Fetch sender info if not already in map
    if (msg.sender_id && !sendersMap[msg.sender_id]) {
      console.log('Fetching sender info for:', msg.sender_id);
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', msg.sender_id)
          .single();

        if (!error && user && msg.sender_id) {
          console.log('Fetched sender user:', user);
          const senderId = msg.sender_id;
          setSendersMap((prev) => {
            const updated = {
              ...prev,
              [senderId]: user,
            };
            console.log('Updated sendersMap:', updated);
            return updated;
          });
        }
      } catch (error) {
        console.error('Error fetching new sender info:', error);
      }
    } else {
      console.log('Sender already in map or no sender_id');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  if (!conversation) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-500">Conversation not found.</Text>
      </View>
    );
  }

  // Determine the display name and avatar from multiple sources
  const displayName =
    channel?.name ??
    otherUserName ??
    (otherUser?.firstname || otherUser?.lastname
      ? `${otherUser?.firstname ?? ''} ${otherUser?.lastname ?? ''}`.trim()
      : otherUser?.username) ??
    'User';

  const displayAvatar = channel?.avatar ?? otherUserAvatar ?? otherUser?.avatar ?? '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header with back button, avatar, and name */}
        <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color={headerIconColor} />
          </TouchableOpacity>
          <DownloadImage
            path={displayAvatar}
            supabase={supabase}
            fallbackUri={avatarUrl}
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
            {displayName}
          </Text>
        </View>
        <SafeAreaView edges={['bottom']} className="flex-1">
          <MessageList messages={messages} currentUserId={user?.id} sendersMap={sendersMap} />
          <MessageInput conversationId={id} onNewMessage={handleNewMessage} />
        </SafeAreaView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
