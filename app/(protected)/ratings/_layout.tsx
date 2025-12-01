import { Stack } from 'expo-router';

export default function RatingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Your Stays',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Rate Your Stay',
        }}
      />
    </Stack>
  );
}
