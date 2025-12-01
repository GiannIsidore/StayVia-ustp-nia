import { Redirect, Tabs } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { Animated, useColorScheme, Platform } from 'react-native';
import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/supabase';
import { getUserById } from '@/services/userService';

function BouncyIcon({ name, focusedName, size, color, focused, bounceAnim }: any) {
  return (
    <Animated.View
      style={{
        transform: [{ scale: bounceAnim }],
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Ionicons name={focused ? focusedName : name} size={size} color={color} />
    </Animated.View>
  );
}

export default function ProtectedTabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const supabase = useSupabase();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // Fetch current user to get account type
  const id = user?.id;
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserById(id as string, supabase),
    enabled: !!id,
  });

  const accountType = currentUser?.account_type;
  const isStudent = accountType !== 'landlord';
  const isLandlord = accountType === 'landlord';

  if (!isLoaded || isLoadingUser) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  const animations = {
    home: useRef(new Animated.Value(1)).current,
    notification: useRef(new Animated.Value(1)).current,
    chat: useRef(new Animated.Value(1)).current,
    account: useRef(new Animated.Value(1)).current,
    ratings: useRef(new Animated.Value(1)).current,
    landlordRentals: useRef(new Animated.Value(1)).current,
  };

  const bounce = (key: keyof typeof animations) => {
    Animated.sequence([
      Animated.spring(animations[key], {
        toValue: 1.15,
        useNativeDriver: true,
        friction: 3,
      }),
      Animated.spring(animations[key], {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }),
    ]).start();
  };

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#667EEA',
        tabBarInactiveTintColor: isDark ? '#a1a1aa' : '#6b7280',
        tabBarStyle: {
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          borderTopWidth: 0,
          elevation: 24,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.4 : 0.05,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 6,
          paddingBottom: 6,
          paddingTop: 4,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <BouncyIcon
              name="home-outline"
              focusedName="home"
              size={size}
              color={color}
              focused={focused}
              bounceAnim={animations.home}
            />
          ),
        }}
        listeners={{ tabPress: () => bounce('home') }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size, focused }) => (
            <BouncyIcon
              name="chatbubble-ellipses-outline"
              focusedName="chatbubble-ellipses"
              size={size}
              color={color}
              focused={focused}
              bounceAnim={animations.chat}
            />
          ),
        }}
        listeners={{ tabPress: () => bounce('chat') }}
      />

      <Tabs.Screen
        name="notification"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size, focused }) => (
            <BouncyIcon
              name="notifications-outline"
              focusedName="notifications"
              size={size}
              color={color}
              focused={focused}
              bounceAnim={animations.notification}
            />
          ),
        }}
        listeners={{ tabPress: () => bounce('notification') }}
      />

      <Tabs.Screen
        name="ratings"
        options={{
          title: 'Your Stays',
          href: isStudent ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <BouncyIcon
              name="bed-outline"
              focusedName="bed"
              size={size}
              color={color}
              focused={focused}
              bounceAnim={animations.ratings}
            />
          ),
        }}
        listeners={{ tabPress: () => bounce('ratings') }}
      />

      <Tabs.Screen
        name="landlord-rentals"
        options={{
          title: 'My Rentals',
          href: isLandlord ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <BouncyIcon
              name="key-outline"
              focusedName="key"
              size={size}
              color={color}
              focused={focused}
              bounceAnim={animations.landlordRentals}
            />
          ),
        }}
        listeners={{ tabPress: () => bounce('landlordRentals') }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size, focused }) => (
            <BouncyIcon
              name="person-outline"
              focusedName="person"
              size={size}
              color={color}
              focused={focused}
              bounceAnim={animations.account}
            />
          ),
        }}
        listeners={{ tabPress: () => bounce('account') }}
      />
    </Tabs>
  );
}
