import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-expo';
import { useSupabase } from '@/lib/supabase';
import { googleCalendarService } from '@/services/googleCalendarService';
import { getActiveRentals } from '@/services/requestService';

interface PaymentDate {
  date: Date;
  amount: number;
  rentalId: string;
  propertyTitle: string;
}

export const useCalendarSync = () => {
  const { user } = useUser();
  const supabase = useSupabase();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Generate payment dates for a rental
  const generatePaymentDates = (rental: any): PaymentDate[] => {
    if (!rental?.rental_start_date || !rental?.rental_end_date || !rental?.monthly_rent_amount) {
      return [];
    }

    const dates: PaymentDate[] = [];
    const startDate = new Date(rental.rental_start_date);
    const endDate = new Date(rental.rental_end_date);
    const paymentDay = rental.payment_day_of_month || startDate.getDate();
    const amount = rental.monthly_rent_amount;
    const propertyTitle = rental.post?.title || 'Property';
    const rentalId = rental.id;

    // Generate payment dates for each month between start and end
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), paymentDay);

      if (paymentDate >= startDate && paymentDate <= endDate) {
        dates.push({
          date: paymentDate,
          amount,
          rentalId,
          propertyTitle,
        });
      }

      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    return dates;
  };

  // Sync all active rentals to calendar
  const syncAllRentalsToCalendar = async () => {
    if (!user?.id) return;

    setIsSyncing(true);
    try {
      console.log('🔄 Starting calendar sync for all rentals...');

      // Get all active rentals
      const activeRentals = await getActiveRentals(user.id, supabase);

      if (activeRentals.length === 0) {
        console.log('ℹ️ No active rentals to sync');
        return;
      }

      let totalSynced = 0;
      let totalFailed = 0;

      // Sync each rental
      for (const rental of activeRentals) {
        try {
          const paymentDates = generatePaymentDates(rental);

          if (paymentDates.length === 0) {
            console.log(`ℹ️ No payment dates for rental ${rental.id}`);
            continue;
          }

          // Check if already synced
          const syncStatus = await googleCalendarService.getRentalSyncStatus(rental.id);

          if (syncStatus === 'synced') {
            console.log(`✅ Rental ${rental.id} already synced`);
            totalSynced++;
            continue;
          }

          // Create calendar events
          await googleCalendarService.createRentalPaymentEvents(
            rental.id,
            rental.post?.title || 'Property',
            paymentDates.map((p) => p.date),
            rental.monthly_rent_amount || 0
          );

          console.log(`✅ Synced rental ${rental.id} with ${paymentDates.length} payments`);
          totalSynced++;
        } catch (error) {
          console.error(`❌ Failed to sync rental ${rental.id}:`, error);
          totalFailed++;
        }
      }

      console.log(`📊 Calendar sync complete: ${totalSynced} synced, ${totalFailed} failed`);
      setLastSyncTime(new Date());

      return {
        total: activeRentals.length,
        synced: totalSynced,
        failed: totalFailed,
      };
    } catch (error) {
      console.error('❌ Calendar sync failed:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync a specific rental
  const syncRentalToCalendar = async (rentalId: string) => {
    if (!user?.id) return;

    setIsSyncing(true);
    try {
      // Get rental details
      const { data: rental, error } = await supabase
        .from('requests')
        .select(
          `
          *,
          post:post_id (
            id,
            title
          )
        `
        )
        .eq('id', rentalId)
        .eq('user_id', user.id)
        .single();

      if (error || !rental) {
        throw new Error('Rental not found');
      }

      const paymentDates = generatePaymentDates(rental);

      if (paymentDates.length === 0) {
        console.log('ℹ️ No payment dates to sync');
        return;
      }

      // Create calendar events
      await googleCalendarService.createRentalPaymentEvents(
        rental.id,
        rental.post?.title || 'Property',
        paymentDates.map((p) => p.date),
        rental.monthly_rent_amount || 0
      );

      console.log(`✅ Synced rental ${rental.id} with ${paymentDates.length} payments`);
      setLastSyncTime(new Date());

      return {
        rentalId,
        paymentsCount: paymentDates.length,
      };
    } catch (error) {
      console.error(`❌ Failed to sync rental ${rentalId}:`, error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Remove calendar events for a rental
  const removeRentalFromCalendar = async (rentalId: string) => {
    setIsSyncing(true);
    try {
      await googleCalendarService.deleteRentalEvents(rentalId);
      console.log(`✅ Removed calendar events for rental ${rentalId}`);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error(`❌ Failed to remove rental ${rentalId} from calendar:`, error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Check sync status for all rentals
  const checkAllSyncStatus = async () => {
    if (!user?.id) return;

    try {
      const activeRentals = await getActiveRentals(user.id, supabase);
      const statusMap = new Map<string, 'synced' | 'partial' | 'none'>();

      for (const rental of activeRentals) {
        const status = await googleCalendarService.getRentalSyncStatus(rental.id);
        statusMap.set(rental.id, status);
      }

      return statusMap;
    } catch (error) {
      console.error('❌ Failed to check sync status:', error);
      return new Map();
    }
  };

  // Auto-sync on component mount (optional)
  useEffect(() => {
    // Uncomment to enable auto-sync on app start
    // if (user?.id) {
    //   syncAllRentalsToCalendar().catch(console.error);
    // }
  }, [user?.id]);

  return {
    isSyncing,
    lastSyncTime,
    syncAllRentalsToCalendar,
    syncRentalToCalendar,
    removeRentalFromCalendar,
    checkAllSyncStatus,
    generatePaymentDates,
  };
};
