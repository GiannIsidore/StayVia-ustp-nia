import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';

/**
 * Hook to listen for scheduled payment notification delivery
 * and update database flags to prevent duplicate notifications.
 *
 * This hook ensures that when Expo fires a scheduled notification (System 1),
 * the database flags are updated so the fallback system (System 2) knows
 * the notification was already delivered.
 *
 * Listens for:
 * 1. Notification received (delivered to device) - even if not tapped
 * 2. Notification tapped (user interacted with notification)
 */
export const usePaymentNotificationListeners = (enabled: boolean = true) => {
  const supabase = useSupabase();
  const { user } = useUser();

  useEffect(() => {
    if (!enabled || !user?.id) return;

    console.log('🎧 Setting up payment notification listeners');

    /**
     * Update payment notification flag in database
     */
    const updatePaymentFlag = async (
      paymentId: string,
      daysUntilDue: number,
      userId: string,
      source: string
    ) => {
      try {
        // Only update if notification is for current user
        if (userId !== user.id) {
          console.log(`⏭️ Skipping flag update - notification not for current user`);
          return;
        }

        // Determine which flag to update based on days until due
        let flagField = '';
        if (daysUntilDue === 3) {
          flagField = 'reminder_3day_sent';
        } else if (daysUntilDue === 1) {
          flagField = 'reminder_1day_sent';
        } else if (daysUntilDue === 0) {
          flagField = 'reminder_duedate_sent';
        }

        if (!flagField) {
          console.log(`⚠️ Unknown daysUntilDue value: ${daysUntilDue}`);
          return;
        }

        // Update database flag
        const { error } = await supabase
          .from('payments')
          .update({ [flagField]: true })
          .eq('id', paymentId);

        if (error) {
          console.error(`❌ Error updating ${flagField}:`, error);
        } else {
          console.log(`✅ Updated ${flagField} = TRUE for payment ${paymentId} (${source})`);
        }
      } catch (err) {
        console.error('❌ Error in updatePaymentFlag:', err);
      }
    };

    /**
     * Listener 1: Notification Received (Delivered to Device)
     * This fires when the notification is delivered, even if user doesn't tap it.
     * This is the primary way to update flags for scheduled notifications.
     */
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        try {
          const data = notification.request.content.data;
          const { type, paymentId, daysUntilDue, userId } = data;

          console.log('📨 Notification received:', {
            type,
            paymentId,
            daysUntilDue,
            userId,
          });

          // Only process payment reminder notifications
          if (type === 'payment_reminder_student' || type === 'payment_reminder_landlord') {
            await updatePaymentFlag(
              paymentId as string,
              daysUntilDue as number,
              userId as string,
              'received'
            );
          }
        } catch (err) {
          console.error('❌ Error in received listener:', err);
        }
      }
    );

    /**
     * Listener 2: Notification Response (User Tapped)
     * This fires when user taps the notification.
     * Acts as a backup in case the received listener didn't fire.
     */
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        try {
          const data = response.notification.request.content.data;
          const { type, paymentId, daysUntilDue, userId } = data;

          console.log('👆 Notification tapped:', {
            type,
            paymentId,
            daysUntilDue,
            userId,
          });

          // Only process payment reminder notifications
          if (type === 'payment_reminder_student' || type === 'payment_reminder_landlord') {
            // Check if flag is already set to avoid unnecessary updates
            const { data: payment } = await supabase
              .from('payments')
              .select('reminder_3day_sent, reminder_1day_sent, reminder_duedate_sent')
              .eq('id', paymentId as string)
              .single();

            if (payment) {
              let alreadySet = false;
              if (daysUntilDue === 3 && payment.reminder_3day_sent) alreadySet = true;
              if (daysUntilDue === 1 && payment.reminder_1day_sent) alreadySet = true;
              if (daysUntilDue === 0 && payment.reminder_duedate_sent) alreadySet = true;

              if (!alreadySet) {
                await updatePaymentFlag(
                  paymentId as string,
                  daysUntilDue as number,
                  userId as string,
                  'tapped'
                );
              } else {
                console.log('✓ Flag already set (received listener handled it)');
              }
            }
          }
        } catch (err) {
          console.error('❌ Error in response listener:', err);
        }
      }
    );

    return () => {
      console.log('🔌 Removing payment notification listeners');
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [enabled, user?.id, supabase]);
};
