import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Image, TouchableOpacity } from 'react-native';
import DownloadImgMsg from './download/downloadImgMsg';
import DownloadImage from './download/downloadImage';
import { useSupabase } from '@/lib/supabase';
import { useUser } from '@clerk/clerk-expo';
import { Database } from '@/types/database.types';

type MessageRow = Database['public']['Tables']['messages']['Row'];

type MessageListItemProps = {
  message: MessageRow;
  isOwnMessage?: boolean;
  senderInfo?: any;
};

export default function MessageListItem({
  message,
  isOwnMessage = false,
  senderInfo = null,
}: MessageListItemProps) {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false); // modal state

  const { user } = useUser();
  const supabase = useSupabase();

  const defaultAvatar = 'https://i.pravatar.cc/150';
  const avatarUrl =
    !user?.imageUrl || user?.imageUrl.includes('clerk.dev/static') ? defaultAvatar : user?.imageUrl;

  const hasImage = Boolean(message.image_path);
  const hasText = Boolean(message.content);

  const toggleTimestamp = () => setShowTimestamp((prev) => !prev);

  // Get sender name
  const getSenderName = () => {
    if (!senderInfo) return 'User';
    if (senderInfo.firstname || senderInfo.lastname) {
      return `${senderInfo.firstname ?? ''} ${senderInfo.lastname ?? ''}`.trim();
    }
    return senderInfo.username ?? 'User';
  };

  // Get sender avatar - use empty string if no avatar, DownloadImage will handle fallback
  const senderAvatar = senderInfo?.avatar ?? '';

  // Debug log
  console.log('MessageListItem:', {
    isOwnMessage,
    hasSenderInfo: !!senderInfo,
    senderName: getSenderName(),
    senderAvatar,
    senderId: message.sender_id,
  });

  return (
    <>
      <Pressable
        onPress={toggleTimestamp}
        className={`mb-2 flex-row ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        {!isOwnMessage && (
          <View style={{ marginRight: 8, marginTop: 4 }}>
            <DownloadImage
              path={senderAvatar}
              supabase={supabase}
              fallbackUri={defaultAvatar}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          </View>
        )}
        <View className={`max-w-[75%] gap-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {/* Sender name (only for other person's messages) */}
          {!isOwnMessage && senderInfo && (
            <Text
              className="mb-1 px-1 text-xs text-gray-500"
              style={{ fontSize: 12, fontWeight: '600' }}>
              {getSenderName()}
            </Text>
          )}

          {/* 🖼️ Image message */}
          {hasImage && message.image_path && (
            <Pressable onPress={() => setFullscreenVisible(true)}>
              <View className="h-32 w-32 overflow-hidden rounded bg-gray-100">
                <DownloadImgMsg
                  path={message.image_path}
                  supabase={supabase}
                  fallbackUri={avatarUrl}
                  className="h-32 w-32 rounded"
                />
              </View>
            </Pressable>
          )}

          {/* 💬 Text bubble */}
          {hasText && message.content && (
            <View
              className={`rounded-2xl px-4 py-2 ${
                isOwnMessage ? 'rounded-br-md bg-blue-500' : 'rounded-bl-md bg-gray-200'
              }`}>
              <Text className={`${isOwnMessage ? 'text-white' : 'text-neutral-900'}`}>
                {message.content}
              </Text>
            </View>
          )}

          {/* ⏱️ Timestamp */}
          {showTimestamp && message.created_at && (
            <Text className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </Text>
          )}
        </View>
      </Pressable>

      {/* Fullscreen image modal */}
      {hasImage && (
        <Modal visible={fullscreenVisible} transparent={true}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.9)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setFullscreenVisible(false)}>
            <DownloadImgMsg
              path={message.image_path}
              supabase={supabase}
              fallbackUri={avatarUrl}
              style={{ width: '90%', height: '90%', borderRadius: 10 }}
            />
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}
