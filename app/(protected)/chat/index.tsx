import React, { useState, useMemo } from "react";
import { FlatList, View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { useUser } from "@clerk/clerk-expo";
import { useSupabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import ChannelListItem from "@/components/ChannelListItem";
import { Database } from "@/types/database.types";
import { useAppTheme } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { Ionicons } from "@expo/vector-icons";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type ConversationParticipant = Database["public"]["Tables"]["conversation_participants"]["Row"];
type User = Database["public"]["Tables"]["users"]["Row"];

// 🔹 Fetch all conversations for the logged-in user
async function getUserConversations(
  supabase: ReturnType<typeof useSupabase>,
  userId: string
) {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(
      `
      conversation_id,
      conversations!inner(id, created_at),
      user_id,
      users!conversation_participants_user_id_fkey(*)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const conversationIds = data.map((p) => p.conversation_id);
  if (conversationIds.length === 0) return [];

  const { data: allParticipants, error: partError } = await supabase
    .from("conversation_participants")
    .select(`conversation_id, user_id, users!conversation_participants_user_id_fkey(*)`)
    .in("conversation_id", conversationIds);

  if (partError) throw partError;

  return conversationIds.map((convId) => {
    const participants = allParticipants.filter((p) => p.conversation_id === convId);
    const other = participants.find((p) => p.user_id !== userId)?.users;
    return {
      id: convId,
      otherUser: other,
    };
  });
}

export default function ChannelListScreen() {
  const { user } = useUser();
  const supabase = useSupabase();
  const { colors } = useAppTheme(); // 🔹 central theme hook

  const [search, setSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<"landlord" | "student" | null>(null);

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getUserConversations(supabase, user!.id),
    enabled: !!user?.id,
  });

  // Filter conversations based on search and account type
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];

    let filtered = conversations;

    // Filter by account type
    if (accountTypeFilter) {
      filtered = filtered.filter((conv) => {
        return conv.otherUser?.account_type === accountTypeFilter;
      });
    }

    // Filter by search term
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter((conv) => {
        const firstName = String(conv.otherUser?.firstname ?? "").toLowerCase();
        const lastName = String(conv.otherUser?.lastname ?? "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        return (
          firstName.includes(lowerSearch) ||
          lastName.includes(lowerSearch) ||
          fullName.includes(lowerSearch)
        );
      });
    }

    return filtered;
  }, [conversations, search, accountTypeFilter]);

  if (isLoading)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );

  if (error)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.foreground }}>Error loading conversations</Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search Input */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: 9999,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Input
            placeholder="Search by name..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, borderWidth: 0, color: colors.foreground }}
          />
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
        </View>
      </View>

      {/* Filter Buttons */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingBottom: 8,
          gap: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setAccountTypeFilter(null)}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: accountTypeFilter === null ? colors.primary : colors.card,
            borderWidth: 1,
            borderColor: accountTypeFilter === null ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: accountTypeFilter === null ? "white" : colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAccountTypeFilter("landlord")}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: accountTypeFilter === "landlord" ? colors.primary : colors.card,
            borderWidth: 1,
            borderColor: accountTypeFilter === "landlord" ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: accountTypeFilter === "landlord" ? "white" : colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            Landlords
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAccountTypeFilter("student")}
          style={{
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: accountTypeFilter === "student" ? colors.primary : colors.card,
            borderWidth: 1,
            borderColor: accountTypeFilter === "student" ? colors.primary : colors.border,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: accountTypeFilter === "student" ? "white" : colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            Students
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      {!filteredConversations?.length ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.mutedForeground }}>
            {search.trim() || accountTypeFilter
              ? "No conversations found"
              : "No conversations yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          style={{ backgroundColor: colors.background }}
          keyExtractor={(item) => item.id ?? ""}
          renderItem={({ item }) => (
            <ChannelListItem
              channel={{
                id: item.id as string,
                name: `${item.otherUser?.firstname ?? ""} ${item.otherUser?.lastname ?? ""}`,
                avatar: item.otherUser?.avatar ?? "",
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </View>
  );
}
