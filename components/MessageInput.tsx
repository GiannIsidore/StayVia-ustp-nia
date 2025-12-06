import {
  View,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import { useSupabase } from "@/lib/supabase";
import { sendMessage, subscribeToMessages, Message } from "@/services/conversationService";
import { useAppTheme } from "@/lib/theme";
import DownloadMsgImages from "./download/downloadMsgImages";
import { useQueryClient } from "@tanstack/react-query";

type MessageInputProps = {
  conversationId: string;
  onNewMessage: (msg: Message) => void;
};

export default function MessageInput({ conversationId, onNewMessage }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadedImagePath, setUploadedImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { user } = useUser();
  const supabase = useSupabase();
  const { colors } = useAppTheme();

  const defaultAvatar = "https://i.pravatar.cc/150";
  const avatarUrl =
    !user?.imageUrl || user?.imageUrl.includes("clerk.dev/static")
      ? defaultAvatar
      : user?.imageUrl;

  // --- Image Upload ---
  const uploadImage = async (localUri: string, bucket: string) => {
    try {
      setUploading(true);
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = localUri.split(".").pop()?.toLowerCase() ?? "jpeg";
      const fileName = `${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, arrayBuffer, { contentType: `image/${fileExt}` });

      if (error) throw error;
      return data.path; // This is the path used to download later
    } catch (err) {
      console.error(err);
      Alert.alert("Upload Error", "Failed to upload image.");
      return null;
    } finally {
      setUploading(false);
    }
  };
  // --- Select Image (Gallery) ---
const handleSelectImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission Denied", "You need to allow access to your photos.");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
  });

  if (!result.canceled && result.assets?.length > 0) {
    const uri = result.assets[0].uri;
    setSelectedImage(uri);

    const path = await uploadImage(uri, "message-img");
    if (path) setUploadedImagePath(path);
  }
};

// --- Take Photo (Camera) ---
const handleTakePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission Denied", "You need to allow access to your camera.");
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 1,
  });

  if (!result.canceled && result.assets?.length > 0) {
    const uri = result.assets[0].uri;
    setSelectedImage(uri);

    const path = await uploadImage(uri, "message-img");
    if (path) setUploadedImagePath(path);
  }
};


  // --- Send Message ---
  const handleSendMessage = async () => {
    if (!user?.id || (!message.trim() && !uploadedImagePath && !selectedImage)) return;

    try {
      const newMsg = await sendMessage(
        supabase,
        conversationId,
        user.id,
        message.trim(),
        uploadedImagePath
      );
      onNewMessage(newMsg);

      queryClient.invalidateQueries({queryKey: ["conversations"]});

      // Reset inputs
      setMessage("");
      setSelectedImage(null);
      setUploadedImagePath(null);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // --- Subscribe to messages ---
  useEffect(() => {
    if (!conversationId) return;
    const subscription = subscribeToMessages(supabase, conversationId, onNewMessage);
    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [conversationId, supabase]);

  const isMessageEmpty = !message.trim() && !selectedImage;

  return (
    <SafeAreaView
      edges={["bottom"]}
      className="px-4 pt-4 pb-1 gap-4 border-t"
      style={{ backgroundColor: colors.card, borderTopColor: colors.border }}
    >
        {selectedImage && (
          <View className="w-32 h-32 relative">
            <DownloadMsgImages
              path={uploadedImagePath ?? undefined} // only download if uploaded
              supabase={supabase}
              fallbackUri={selectedImage} // preview local image instantly
              className="w-32 h-32 rounded"
            />
            <Pressable
              onPress={() => {
                setSelectedImage(null);
                setUploadedImagePath(null);
              }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.muted }}
            >
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}

        <View className="flex-row items-center gap-2 pb-2">
          {/* Camera */}
          <Pressable
            onPress={handleTakePhoto}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.muted }}
          >
            <Ionicons name="camera" size={20} color={colors.mutedForeground} />
          </Pressable>

          {/* Gallery */}
          <Pressable
            onPress={handleSelectImage}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.muted }}
          >
            <Ionicons name="image" size={20} color={colors.mutedForeground} />
          </Pressable>

          {/* Text input */}
          <TextInput
            placeholder="Type something..."
            placeholderTextColor={colors.mutedForeground}
            value={message}
            onChangeText={setMessage}
            multiline
            className="flex-1 rounded-3xl px-4 py-3 max-h-[120px]"
            style={{
              backgroundColor: colors.input,
              color: colors.foreground,
              fontSize: 14,
            }}
          />

          {/* Send button */}
          <Pressable
            onPress={handleSendMessage}
            disabled={isMessageEmpty || uploading}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: isMessageEmpty ? colors.muted : colors.primary }}
          >
            <Ionicons
              name="send"
              size={20}
              color={isMessageEmpty ? colors.mutedForeground : colors.primaryForeground}
            />
          </Pressable>
        </View>
    </SafeAreaView>
  );
}
