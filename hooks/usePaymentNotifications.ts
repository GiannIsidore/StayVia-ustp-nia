import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { useAccountType } from './useAccountType';

export const usePaymentNotifications = (enabled: boolean = true) => {
  const { user } = useUser();
  const supabase = useSupabase();
  const { accountType, isLoading: accountTypeLoading } = useAccountType();

  useEffect(() => {
    // Only run if explicitly enabled and user is available
    if (!enabled || !user?.id) return;

    let appStateSubscription: any;

    const checkAndSendNotifications = async () => {
      try {
        if (!enabled) return; // Double check before making network requests

        // Wait for accountType to load before proceeding
        if (accountTypeLoading || accountType === null || accountType === undefined) {
          console.log('⏳ Waiting for account type to load...', {
            accountType,
            accountTypeLoading,
          });
          return;
        }

        const userId = user.id;
        const isLandlord = accountType === 'landlord';
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Calculate reminder dates
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        const threeDaysDate = threeDaysFromNow.toISOString().split('T')[0];

        const oneDayFromNow = new Date(now);
        oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
        const oneDayDate = oneDayFromNow.toISOString().split('T')[0];

        console.log('🔍 Checking for payment notifications...', {
          userId,
          isLandlord,
          accountType,
          today,
          threeDaysDate,
          oneDayDate,
        });

        // Query payments needing notifications
        if (isLandlord) {
          // LANDLORD: Check payments for properties they own
          // 3-day reminders
          const { data: threeDayPayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              reminder_3day_sent,
              notification_3day_id,
              tenant:tenant_id(firstname, lastname),
              post:post_id(title)
            `
            )
            .eq('landlord_id', userId)
            .eq('status', 'unpaid')
            .eq('reminder_3day_sent', false)
            .is('notification_3day_id', null) // Only send if no scheduled notification exists
            .eq('due_date', threeDaysDate);

          if (threeDayPayments && threeDayPayments.length > 0) {
            for (const payment of threeDayPayments) {
              const tenantName = `${(payment as any).tenant?.firstname} ${(payment as any).tenant?.lastname}`;
              await notificationService.sendLocalNotification(
                '💰 Upcoming Payment',
                `${tenantName} - ₱${payment.amount.toLocaleString()} due in 3 days`,
                {
                  type: 'payment_reminder_landlord',
                  action: 'open_landlord_payments',
                  paymentId: payment.id,
                },
                2
              );

              // Mark as sent
              await supabase
                .from('payments')
                .update({ reminder_3day_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent 3-day reminder for payment ${payment.id} (landlord)`);
            }
          }

          // 1-day reminders
          const { data: oneDayPayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              reminder_1day_sent,
              notification_1day_id,
              tenant:tenant_id(firstname, lastname),
              post:post_id(title)
            `
            )
            .eq('landlord_id', userId)
            .eq('status', 'unpaid')
            .eq('reminder_1day_sent', false)
            .is('notification_1day_id', null) // Only send if no scheduled notification exists
            .eq('due_date', oneDayDate);

          if (oneDayPayments && oneDayPayments.length > 0) {
            for (const payment of oneDayPayments) {
              const tenantName = `${(payment as any).tenant?.firstname} ${(payment as any).tenant?.lastname}`;
              await notificationService.sendLocalNotification(
                '💰 Payment Due Tomorrow',
                `${tenantName} - ₱${payment.amount.toLocaleString()} due tomorrow`,
                {
                  type: 'payment_reminder_landlord',
                  action: 'open_landlord_payments',
                  paymentId: payment.id,
                },
                2
              );

              await supabase
                .from('payments')
                .update({ reminder_1day_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent 1-day reminder for payment ${payment.id} (landlord)`);
            }
          }

          // Due date reminders
          const { data: dueTodayPayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              reminder_duedate_sent,
              notification_duedate_id,
              tenant:tenant_id(firstname, lastname),
              post:post_id(title)
            `
            )
            .eq('landlord_id', userId)
            .eq('status', 'unpaid')
            .eq('reminder_duedate_sent', false)
            .is('notification_duedate_id', null) // Only send if no scheduled notification exists
            .eq('due_date', today);

          if (dueTodayPayments && dueTodayPayments.length > 0) {
            for (const payment of dueTodayPayments) {
              const tenantName = `${(payment as any).tenant?.firstname} ${(payment as any).tenant?.lastname}`;
              await notificationService.sendLocalNotification(
                '💰 Payment Due Today',
                `${tenantName} - ₱${payment.amount.toLocaleString()} due today`,
                {
                  type: 'payment_reminder_landlord',
                  action: 'open_landlord_payments',
                  paymentId: payment.id,
                },
                2
              );

              await supabase
                .from('payments')
                .update({ reminder_duedate_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent due date reminder for payment ${payment.id} (landlord)`);
            }
          }

          // Overdue payments
          const { data: overduePayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              overdue_notif_sent,
              tenant:tenant_id(firstname, lastname),
              post:post_id(title)
            `
            )
            .eq('landlord_id', userId)
            .eq('status', 'unpaid')
            .eq('overdue_notif_sent', false)
            .lt('due_date', today);

          if (overduePayments && overduePayments.length > 0) {
            for (const payment of overduePayments) {
              const dueDate = new Date(payment.due_date);
              const daysOverdue = Math.floor(
                (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              const tenantName = `${(payment as any).tenant?.firstname} ${(payment as any).tenant?.lastname}`;

              await notificationService.sendOverduePaymentNotification(
                payment.amount,
                (payment as any).post?.title || 'Property',
                tenantName,
                daysOverdue,
                true // isLandlord
              );

              await supabase
                .from('payments')
                .update({ overdue_notif_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent overdue notification for payment ${payment.id} (landlord)`);
            }
          }
        } else {
          // STUDENT/TENANT: Check payments they need to make
          console.log('👨‍🎓 Running STUDENT notification checks for user:', userId);

          // 3-day reminders
          const { data: threeDayPayments, error: threeDayError } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              reminder_3day_sent,
              notification_3day_id,
              post:post_id(title)
            `
            )
            .eq('tenant_id', userId)
            .eq('status', 'unpaid')
            .eq('reminder_3day_sent', false)
            .is('notification_3day_id', null) // Only send if no scheduled notification exists
            .eq('due_date', threeDaysDate);

          if (threeDayError) {
            console.error('❌ Error fetching 3-day payments (student):', threeDayError);
          }
          console.log('📊 Student 3-day reminders found:', threeDayPayments?.length || 0);

          if (threeDayPayments && threeDayPayments.length > 0) {
            for (const payment of threeDayPayments) {
              const postTitle = (payment as any).post?.title || 'Your rental';
              await notificationService.sendLocalNotification(
                '💰 Payment Reminder',
                `Payment due in 3 days: ₱${payment.amount.toLocaleString()} for ${postTitle}`,
                {
                  type: 'payment_reminder_student',
                  action: 'open_student_payments',
                  paymentId: payment.id,
                },
                2
              );

              await supabase
                .from('payments')
                .update({ reminder_3day_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent 3-day reminder for payment ${payment.id} (student)`);
            }
          }

          // 1-day reminders
          const { data: oneDayPayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              reminder_1day_sent,
              notification_1day_id,
              post:post_id(title)
            `
            )
            .eq('tenant_id', userId)
            .eq('status', 'unpaid')
            .eq('reminder_1day_sent', false)
            .is('notification_1day_id', null) // Only send if no scheduled notification exists
            .eq('due_date', oneDayDate);

          if (oneDayPayments && oneDayPayments.length > 0) {
            for (const payment of oneDayPayments) {
              const postTitle = (payment as any).post?.title || 'Your rental';
              await notificationService.sendLocalNotification(
                '💰 Payment Due Tomorrow',
                `₱${payment.amount.toLocaleString()} due tomorrow for ${postTitle}`,
                {
                  type: 'payment_reminder_student',
                  action: 'open_student_payments',
                  paymentId: payment.id,
                },
                2
              );

              await supabase
                .from('payments')
                .update({ reminder_1day_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent 1-day reminder for payment ${payment.id} (student)`);
            }
          }

          // Due date reminders
          const { data: dueTodayPayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              reminder_duedate_sent,
              notification_duedate_id,
              post:post_id(title)
            `
            )
            .eq('tenant_id', userId)
            .eq('status', 'unpaid')
            .eq('reminder_duedate_sent', false)
            .is('notification_duedate_id', null) // Only send if no scheduled notification exists
            .eq('due_date', today);

          if (dueTodayPayments && dueTodayPayments.length > 0) {
            for (const payment of dueTodayPayments) {
              const postTitle = (payment as any).post?.title || 'Your rental';
              await notificationService.sendLocalNotification(
                '💰 Payment Due Today',
                `₱${payment.amount.toLocaleString()} due today for ${postTitle}`,
                {
                  type: 'payment_reminder_student',
                  action: 'open_student_payments',
                  paymentId: payment.id,
                },
                2
              );

              await supabase
                .from('payments')
                .update({ reminder_duedate_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent due date reminder for payment ${payment.id} (student)`);
            }
          }

          // Overdue payments
          const { data: overduePayments } = await supabase
            .from('payments')
            .select(
              `
              id,
              amount,
              due_date,
              overdue_notif_sent,
              post:post_id(title)
            `
            )
            .eq('tenant_id', userId)
            .eq('status', 'unpaid')
            .eq('overdue_notif_sent', false)
            .lt('due_date', today);

          if (overduePayments && overduePayments.length > 0) {
            for (const payment of overduePayments) {
              const dueDate = new Date(payment.due_date);
              const daysOverdue = Math.floor(
                (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
              );
              const postTitle = (payment as any).post?.title || 'Your rental';

              await notificationService.sendOverduePaymentNotification(
                payment.amount,
                postTitle,
                '', // tenantName not needed for student view
                daysOverdue,
                false // isLandlord
              );

              await supabase
                .from('payments')
                .update({ overdue_notif_sent: true })
                .eq('id', payment.id);

              console.log(`✅ Sent overdue notification for payment ${payment.id} (student)`);
            }
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
  }, [user?.id, accountType, accountTypeLoading, enabled, supabase]);
};
