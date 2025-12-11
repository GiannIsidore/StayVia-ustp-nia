import { SocialConnections } from '@/components/auth/social-connections';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSignUp } from '@clerk/clerk-expo';
import { Link, router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useSupabase } from '@/lib/supabase';
import { checkUserExistsByEmail } from '@/services/userService';

export function SignUpForm() {
  const { signUp, isLoaded } = useSignUp();
  const supabase = useSupabase();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const passwordInputRef = React.useRef<TextInput>(null);

  const [error, setError] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  async function onSubmit() {
    if (!isLoaded) {
      Alert.alert('Error', 'Authentication service is not ready. Please try again.');
      return;
    }

    setError({});

    // Validation
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setError(newErrors);
      return;
    }

    try {
      setLoading(true);

      console.log('Creating sign up with email:', email);

      // 🔹 Check if email already exists in Supabase database
      // This catches old/existing accounts that might not be in Clerk
      const emailExistsInDb = await checkUserExistsByEmail(email, supabase);

      if (emailExistsInDb) {
        Alert.alert(
          'Email Already Registered',
          'This email address is already associated with an account. Please try signing in instead, or use a different email.',
          [
            {
              text: 'Go to Sign In',
              onPress: () => router.replace('/(auth)/sign-in'),
            },
            {
              text: 'Use Different Email',
              style: 'cancel',
            },
          ]
        );
        setError({ email: 'This email is already registered' });
        return;
      }

      const signUpResult = await signUp.create({
        emailAddress: email,
        password,
        username: email.split('@')[0], // Use email prefix as username
      });

      console.log('Sign up created successfully:', signUpResult.status);

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      console.log('Email verification prepared, navigating to verify-email');

      router.push(`/(auth)/sign-up/verify-email?email=${email}`);
    } catch (err: any) {
      console.error('Sign up error:', err);

      // Handle Clerk errors which have a specific structure
      if (err?.errors && Array.isArray(err.errors)) {
        const errorMessages = err.errors.map((e: any) => e.message || e.longMessage).join('\n');
        Alert.alert('Sign Up Error', errorMessages);

        // Set appropriate error fields
        const firstError = err.errors[0];
        if (
          firstError?.meta?.paramName === 'email_address' ||
          firstError?.code?.includes('email')
        ) {
          setError({ email: firstError.message || firstError.longMessage });
        } else if (
          firstError?.meta?.paramName === 'password' ||
          firstError?.code?.includes('password')
        ) {
          setError({ password: firstError.message || firstError.longMessage });
        } else {
          setError({ general: errorMessages });
        }
        return;
      }

      // Handle standard Error objects
      if (err instanceof Error) {
        Alert.alert('Sign Up Error', err.message);
        const isEmailMessage =
          err.message.toLowerCase().includes('identifier') ||
          err.message.toLowerCase().includes('email');

        if (isEmailMessage) {
          setError({ email: err.message });
        } else if (err.message.toLowerCase().includes('password')) {
          setError({ password: err.message });
        } else {
          setError({ general: err.message });
        }
        return;
      }

      // Handle unknown errors
      console.error('Unknown error type:', JSON.stringify(err, null, 2));
      Alert.alert('Sign Up Error', 'An unexpected error occurred. Please try again.');
      setError({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="gap-6">
      <Card className="border-border/0 shadow-none sm:border-border sm:shadow-sm sm:shadow-black/5">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-extrabold text-primary sm:text-left">
            Create Account
          </CardTitle>
          <CardDescription className="text-center sm:text-left">
            Enter your email and password to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          {/* General Error Display */}
          {error.general ? (
            <View className="rounded-lg bg-red-50 p-4 dark:bg-red-950">
              <Text className="text-sm font-medium text-red-800 dark:text-red-200">
                {error.general}
              </Text>
            </View>
          ) : null}

          <View className="gap-5">
            {/* Email */}
            <View className="gap-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                placeholder="m@example.com"
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
              {error.email ? (
                <Text className="text-sm font-medium text-destructive">{error.email}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View className="gap-1.5">
              <Label htmlFor="password">Password *</Label>
              <View className="relative">
                <Input
                  ref={passwordInputRef}
                  id="password"
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3">
                  {showPassword ? (
                    <EyeOff size={20} color="#6b7280" />
                  ) : (
                    <Eye size={20} color="#6b7280" />
                  )}
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                Must be at least 8 characters long
              </Text>
              {error.password ? (
                <Text className="text-sm font-medium text-destructive">{error.password}</Text>
              ) : null}
            </View>

            {/* Submit Button */}
            <Button className="w-full" onPress={onSubmit} disabled={loading}>
              {loading ? (
                <View className="flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="font-bold text-white">Creating Account...</Text>
                </View>
              ) : (
                <Text className="font-bold text-white">Create Account</Text>
              )}
            </Button>
          </View>

          <Text className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/(auth)/sign-in" className="text-sm underline underline-offset-4">
              Sign in
            </Link>
          </Text>

          <View className="flex-row items-center">
            <Separator className="flex-1" />
            <Text className="px-4 text-sm text-muted-foreground">or</Text>
            <Separator className="flex-1" />
          </View>

          <SocialConnections />
        </CardContent>
      </Card>
    </View>
  );
}
