import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { notificationService } from '@/services/notificationService';

export const useRentalNotifications = (enabled: boolean = true) => {
  const { user } = useUser();
  const supabase = useSupabase();
  const router = useRouter();

  // Setup notification tap handler (always enable this for UX)
  useEffect(() => {
    const unsubscribe = notificationService.setupNotificationResponseListener((notification) => {
      const data = notification.request.content.data;

      if (data.action === 'open_ratings') {
        // Navigate to ratings page when notification is tapped
        router.push('/(protected)/ratings');
      } else if (data.action === 'open_payments') {
        // Navigate to payment schedule when payment notification is tapped
        router.push('/(protected)/landlord-rentals/payment-calendar');
      } else if (data.action === 'open_calendar') {
        // Navigate to calendar page when calendar notification is tapped
        router.push('/(protected)/calendar');
      }
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    // Only run if explicitly enabled and user is available
    if (!enabled || !user?.id) return;

    let appStateSubscription: any;

    const checkAndSendNotifications = async () => {
      try {
        if (!enabled) return; // Double check before making network requests

        const userId = user.id;
        console.log('🔍 Checking for rentals due for rating...', userId);

        // Query for confirmed rentals that:
        // 1. Are confirmed
        // 2. Have rental_start_date set
        // 3. rental_start_date + 1 minute has passed (for testing)
        // 4. Notification hasn't been sent yet
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

        // Get rentals where current user is the tenant
        const { data: studentRentals, error: studentError } = await supabase
          .from('requests')
          .select(
            `
            id,
            rental_start_date,
            rating_notif_sent,
            post_id,
            posts (
              id,
              title,
              price_per_night
            )
          `
          )
          .eq('user_id', userId)
          .eq('confirmed', true)
          .eq('rating_notif_sent', false)
          .not('rental_start_date', 'is', null)
          .lte('rental_start_date', oneMinuteAgo.toISOString());

        if (studentError) {
          console.error('❌ Error fetching student rentals:', studentError);
          return;
        }

        const rentalToNotify = studentRentals || [];
        console.log(`📊 Found ${rentalToNotify.length} rentals due for rating`);

        if (rentalToNotify.length === 0) {
          console.log('ℹ️ No rentals due for rating at this time');
          return;
        }

        // Send notification for each rental
        for (const rental of rentalToNotify) {
          try {
            const postTitle = (rental as any).posts?.title || 'Your rental';
            console.log(`📲 Sending notification for: ${postTitle}`);

            // Send push notification
            await notificationService.sendRatingReminderNotification(postTitle);

            // Mark notification as sent
            const { error: updateError } = await supabase
              .from('requests')
              .update({
                rating_notif_sent: true,
                rating_notif_sent_at: new Date().toISOString(),
              })
              .eq('id', rental.id);

            if (updateError) {
              console.error('❌ Error updating notification status:', updateError);
            } else {
              console.log('✅ Notification marked as sent');
            }
          } catch (err) {
            console.error('❌ Error sending notification for rental:', rental.id, err);
          }
        }
      } catch (err) {
        console.error('❌ Error in checkAndSendNotifications:', err);
      }
    };

    // Delay initial check to avoid blocking app startup
    const initialCheckTimer = setTimeout(() => {
      checkAndSendNotifications();
    }, 3000); // Wait 3 seconds after mount

    // Listen for app state changes
    appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        // App has come to foreground
        checkAndSendNotifications();
      }
    });

    return () => {
      clearTimeout(initialCheckTimer);
      appStateSubscription?.remove();
    };
  }, [user?.id, enabled]);
};
