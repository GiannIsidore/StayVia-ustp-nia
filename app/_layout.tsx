import '@/global.css';
import { NAV_THEME } from '@/lib/theme';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/lib/supabase';
import { getUserById } from '@/services/userService';
import { useRentalNotifications } from '@/hooks/useRentalNotifications';
import { notificationService } from '@/services/notificationService';
import Toast from 'react-native-toast-message';
import { ThemeProvider as CustomThemeProvider, useTheme } from '@/lib/ThemeContext';

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  if (!publishableKey) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in environment variables');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} telemetry={false}>
        <CustomThemeProvider>
          <ThemedApp />
        </CustomThemeProvider>
      </ClerkProvider>
    </QueryClientProvider>
  );
}

function ThemedApp() {
  const { effectiveTheme } = useTheme();

  return (
    <ThemeProvider value={NAV_THEME[effectiveTheme] as any}>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
      <Routes />
      <PortalHost />
      <Toast />
    </ThemeProvider>
  );
}

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const supabase = useSupabase();
  const [userExists, setUserExists] = React.useState<boolean | null>(null);

  // Log user ID only when Clerk is loaded to avoid undefined logs
  React.useEffect(() => {
    if (isLoaded) {
      console.log('🚀 App ready - User ID:', user?.id, '| Signed in:', isSignedIn);
    }
  }, [isLoaded, user?.id, isSignedIn]);

  // Initialize rental notifications hook (only when fully loaded and user exists)
  const shouldInitNotifications = isLoaded && isSignedIn && userExists === true;
  useRentalNotifications(shouldInitNotifications);

  // Initialize rental notifications hook (only when signed in and user exists)
  const shouldEnableNotifications = isLoaded && isSignedIn && userExists;

  // Request notification permissions AFTER app is fully loaded (non-blocking)
  React.useEffect(() => {
    if (shouldEnableNotifications) {
      // Delay to avoid blocking the main thread
      const timer = setTimeout(() => {
        console.log('📢 Requesting notification permissions...');
        notificationService.getPushToken().catch((err) => {
          console.log('⚠️ Could not get push token:', err);
        });
      }, 2000); // Wait 2 seconds after app loads

      return () => clearTimeout(timer);
    }
  }, [shouldEnableNotifications]);

  // Hide splash once Clerk is ready
  React.useEffect(() => {
    if (isLoaded) SplashScreen.hideAsync();
  }, [isLoaded]);

  const id = user?.id;

  // Fetch user from Supabase with optimized caching
  const { data, error, isLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserById(id as string, supabase),
    enabled: !!id && isSignedIn, // Only fetch when signed in
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Only retry once on failure
  });

  // Set userExists safely inside useEffect
  React.useEffect(() => {
    if (!isLoading) {
      setUserExists(!!data);
    }
  }, [data, isLoading]);

  if (!isLoaded || (isSignedIn && userExists === null)) {
    return null; // wait until checks are done
  }

  return (
    <Stack>
      {/* CreateUser route */}
      <Stack.Protected guard={isSignedIn && !userExists}>
        <Stack.Screen name="(createUser)" options={HOME_SCREEN_OPTIONS} />
      </Stack.Protected>
      {/* Auth routes */}
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)/sign-in" options={SIGN_IN_SCREEN_OPTIONS} />
        <Stack.Screen name="(auth)/sign-up" options={SIGN_UP_SCREEN_OPTIONS} />
        <Stack.Screen name="(auth)/reset-password" options={DEFAULT_AUTH_SCREEN_OPTIONS} />
        <Stack.Screen name="(auth)/forgot-password" options={DEFAULT_AUTH_SCREEN_OPTIONS} />
      </Stack.Protected>

      {/* Main app routes */}
      <Stack.Protected guard={isSignedIn && !!userExists}>
        <Stack.Screen name="(protected)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(profile)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(chat)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(channel)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(user)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(createLandlord)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(conversation)" options={HOME_SCREEN_OPTIONS} />
        <Stack.Screen name="(post)" options={HOME_SCREEN_OPTIONS} />
      </Stack.Protected>
    </Stack>
  );
}

const HOME_SCREEN_OPTIONS = {
  headerShown: false,
  title: 'Home',
};

const SIGN_IN_SCREEN_OPTIONS = {
  headerShown: false,
  title: 'Sign in',
};

const SIGN_UP_SCREEN_OPTIONS = {
  presentation: 'modal',
  title: '',
  headerTransparent: true,
  gestureEnabled: false,
} as const;

const DEFAULT_AUTH_SCREEN_OPTIONS = {
  title: '',
  headerShadowVisible: false,
  headerTransparent: true,
};
