import { Stack } from 'expo-router';

export default function LandlordRentalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Manage Rentals',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Rental Details',
        }}
      />
      <Stack.Screen
        name="payment-calendar"
        options={{
          title: 'Payment Schedule',
        }}
      />
    </Stack>
  );
}
