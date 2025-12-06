import React from 'react';
import { FlatList } from 'react-native';
import MessageListItem from './MessageListItem';
import { Message } from '@/services/conversationService';

type MessageListProps = {
  messages: Message[];
  currentUserId?: string;
  sendersMap?: Record<string, any>;
};

export default function MessageList({
  messages,
  currentUserId,
  sendersMap = {},
}: MessageListProps) {
  console.log('MessageList - sendersMap:', sendersMap);
  console.log('MessageList - messages count:', messages.length);
  console.log('MessageList - currentUserId:', currentUserId);

  return (
    <FlatList
      data={messages.slice().reverse()} // reverse for inverted scrolling
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const senderInfo = item.sender_id ? sendersMap[item.sender_id] : null;
        console.log(
          `Message ${item.id} - sender_id: ${item.sender_id}, has senderInfo: ${!!senderInfo}`
        );

        return (
          <MessageListItem
            message={item}
            isOwnMessage={item.sender_id === currentUserId}
            senderInfo={senderInfo}
          />
        );
      }}
      inverted // newest messages at bottom
      contentContainerStyle={{ padding: 16 }}
      showsVerticalScrollIndicator={false}
    />
  );
}
