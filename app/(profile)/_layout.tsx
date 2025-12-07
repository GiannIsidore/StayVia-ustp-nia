import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="editProfile"
        options={{
          title: 'Update Profile',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Account Settings',
        }}
      />
      <Stack.Screen
        name="about"
        options={{
          title: 'StayVia',
        }}
      />
      <Stack.Screen
        name="help"
        options={{
          title: 'Help & FAQs',
        }}
      />
      <Stack.Screen
        name="contact"
        options={{
          title: 'Contact Support',
        }}
      />
      <Stack.Screen
        name="terms"
        options={{
          title: 'Terms & Conditions',
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: 'Privacy Policy',
        }}
      />
    </Stack>
  );
}
