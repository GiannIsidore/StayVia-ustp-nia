import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables } from '@/types/database.types';
import { notificationService } from './notificationService';

type Payment = Tables<'payments'>;

// Helper function to format date as YYYY-MM-DD
// Uses UTC methods to avoid timezone issues when dates are stored as UTC
const formatLocalDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const paymentService = {
  /**
   * Create payments for an entire rental period
   * Called when a rental is confirmed
   */
  async createPaymentsForRental(
    requestId: string,
    landlordId: string,
    tenantId: string,
    postId: string,
    rentalStartDate: string,
    rentalEndDate: string,
    monthlyRent: number,
    paymentDayOfMonth: number,
    supabase: SupabaseClient<Database>
  ) {
    const payments: Partial<Payment>[] = [];

    // Parse dates as YYYY-MM-DD strings to avoid timezone issues
    const parseDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
      return { year, month: month - 1, day }; // month is 0-indexed
    };

    const start = parseDate(rentalStartDate);
    const end = parseDate(rentalEndDate);

    // Create Date objects at noon UTC to avoid timezone edge cases
    const startDate = new Date(Date.UTC(start.year, start.month, start.day, 12, 0, 0));
    const endDate = new Date(Date.UTC(end.year, end.month, end.day, 12, 0, 0));

    // Generate payment dates for each month
    console.log('💳 Creating payments for rental:', {
      startDate: rentalStartDate,
      endDate: rentalEndDate,
      paymentDay: paymentDayOfMonth,
      monthlyRent,
    });

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const year = currentDate.getUTCFullYear();
      const month = currentDate.getUTCMonth();

      // Create payment date for this month at noon UTC
      let paymentDate = new Date(Date.UTC(year, month, paymentDayOfMonth, 12, 0, 0));

      // If payment day is beyond the last day of month, use last day
      const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0)).getUTCDate();
      if (paymentDayOfMonth > lastDayOfMonth) {
        paymentDate = new Date(Date.UTC(year, month, lastDayOfMonth, 12, 0, 0));
      }

      console.log('💳 Checking payment date:', {
        paymentDate: formatLocalDate(paymentDate),
        startDate: formatLocalDate(startDate),
        endDate: formatLocalDate(endDate),
        isWithinRange: paymentDate >= startDate && paymentDate <= endDate,
      });

      // Only add if payment date is within rental period
      if (paymentDate >= startDate && paymentDate <= endDate) {
        const dueDate = formatLocalDate(paymentDate);
        console.log('✅ Adding payment with due_date:', dueDate);
        payments.push({
          request_id: requestId,
          landlord_id: landlordId,
          tenant_id: tenantId,
          post_id: postId,
          amount: monthlyRent,
          due_date: dueDate,
          status: 'unpaid',
        });
      } else {
        console.log('❌ Payment date outside range, skipping');
      }

      // Move to next month
      currentDate = new Date(Date.UTC(year, month + 1, 1, 12, 0, 0));
    }

    console.log('💳 Total payments to create:', payments.length);
    console.log(
      '💳 Payment dates:',
      payments.map((p) => p.due_date)
    );

    if (payments.length === 0) {
      return [];
    }

    console.log('💳 Inserting payments into database...');
    const { data, error } = await supabase
      .from('payments')
      .insert(payments as Payment[])
      .select();

    if (error) {
      console.error('❌ Error creating payments for rental:', error);
      throw error;
    }

    console.log('✅ Payments inserted successfully:', data?.length || 0, 'payments');
    console.log(
      '💳 Inserted payment IDs:',
      data?.map((p) => p.id)
    );
    return data ?? [];
  },

  /**
   * Get all payments for a landlord (optionally filtered by month)
   * If month/year are not provided, returns ALL payments
   */
  async getPaymentsByLandlord(
    landlordId: string,
    month?: number,
    year?: number,
    supabase?: SupabaseClient<Database>
  ) {
    if (!supabase) throw new Error('Supabase client required');

    let query = supabase
      .from('payments')
      .select(
        `
        *,
        tenant:tenant_id(id, firstname, lastname, avatar, email),
        post:post_id(id, title, location),
        request:request_id(id, rental_start_date, rental_end_date)
      `
      )
      .eq('landlord_id', landlordId);

    // Only filter by month if provided
    if (month !== undefined && year !== undefined) {
      const startDate = formatLocalDate(new Date(year, month, 1));
      const endDate = formatLocalDate(new Date(year, month + 1, 0));
      query = query.gte('due_date', startDate).lte('due_date', endDate);
    }

    const { data, error } = await query.order('due_date', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get all payments for a tenant
   */
  async getPaymentsByTenant(tenantId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from('payments')
      .select(
        `
        *,
        landlord:landlord_id(id, firstname, lastname, avatar),
        post:post_id(id, title, location)
      `
      )
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Update payment status and details
   */
  async updatePaymentStatus(
    paymentId: string,
    status: string,
    paymentDate?: string,
    notes?: string,
    paymentMethod?: string,
    amountPaid?: number,
    supabase?: SupabaseClient<Database>
  ) {
    if (!supabase) throw new Error('Supabase client required');

    const updateData: Partial<Payment> = {
      status: status as any,
      updated_at: new Date().toISOString(),
    };

    if (paymentDate) {
      updateData.payment_date = paymentDate;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (paymentMethod) {
      updateData.payment_method = paymentMethod;
    }
    if (amountPaid !== undefined) {
      updateData.amount_paid = amountPaid;
    }

    // If marking as paid, reset notification tracking flags
    if (status === 'paid') {
      updateData.reminder_3day_sent = false;
      updateData.reminder_1day_sent = false;
      updateData.reminder_duedate_sent = false;
      updateData.overdue_notif_sent = false;
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;

    // Cancel scheduled notifications if payment is marked as paid
    if (status === 'paid') {
      try {
        await this.cancelPaymentNotifications(paymentId, supabase);
      } catch (cancelError) {
        console.error('Error cancelling notifications:', cancelError);
        // Don't throw - payment update should succeed even if notification cancellation fails
      }
    }

    return data;
  },

  /**
   * Get payment statistics for landlord
   */
  async getPaymentStats(landlordId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from('payments')
      .select('status, amount')
      .eq('landlord_id', landlordId);

    if (error) throw error;

    const payments = data ?? [];
    const stats = {
      total_due: 0,
      total_paid: 0,
      total_overdue: 0,
      total_partial: 0,
      payment_count: payments.length,
      paid_count: 0,
      unpaid_count: 0,
      overdue_count: 0,
      partial_count: 0,
    };

    const now = new Date();

    for (const payment of payments) {
      const amount = payment.amount || 0;
      switch (payment.status) {
        case 'paid':
          stats.total_paid += amount;
          stats.paid_count += 1;
          break;
        case 'unpaid':
          stats.total_due += amount;
          stats.unpaid_count += 1;
          break;
        case 'overdue':
          stats.total_overdue += amount;
          stats.overdue_count += 1;
          break;
        case 'partial':
          stats.total_partial += amount;
          stats.partial_count += 1;
          break;
      }
    }

    return stats;
  },

  /**
   * Get overdue payments for landlord
   */
  async getOverduePayments(landlordId: string, supabase: SupabaseClient<Database>) {
    const now = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('payments')
      .select(
        `
        *,
        tenant:tenant_id(id, firstname, lastname, avatar, email),
        post:post_id(id, title, location)
      `
      )
      .eq('landlord_id', landlordId)
      .eq('status', 'unpaid')
      .lt('due_date', now)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get all payments for a rental request
   */
  async getPaymentsByRequest(requestId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('request_id', requestId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Delete a payment (e.g., if rental is cancelled)
   */
  async deletePayment(paymentId: string, supabase: SupabaseClient<Database>) {
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);

    if (error) throw error;
  },

  /**
   * Delete all payments for a rental
   */
  async deletePaymentsForRental(requestId: string, supabase: SupabaseClient<Database>) {
    const { error } = await supabase.from('payments').delete().eq('request_id', requestId);

    if (error) throw error;
  },

  /**
   * Mark all unpaid future payments as cancelled
   */
  async cancelFuturePayments(requestId: string, supabase: SupabaseClient<Database>) {
    const now = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('payments')
      .update({ status: 'cancelled' })
      .eq('request_id', requestId)
      .eq('status', 'unpaid')
      .gt('due_date', now);

    if (error) throw error;
  },

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string, supabase: SupabaseClient<Database>) {
    const { data, error } = await supabase
      .from('payments')
      .select(
        `
        *,
        tenant:tenant_id(id, firstname, lastname, avatar, email),
        landlord:landlord_id(id, firstname, lastname, avatar),
        post:post_id(id, title, location),
        request:request_id(id, rental_start_date, rental_end_date)
      `
      )
      .eq('id', paymentId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },

  /**
   * Schedule notifications for a payment
   */
  async schedulePaymentNotifications(
    paymentId: string,
    dueDate: string,
    amount: number,
    postTitle: string,
    tenantName: string,
    landlordName: string,
    landlordId: string,
    tenantId: string,
    supabase: SupabaseClient<Database>
  ) {
    try {
      const { threeDayNotifId, oneDayNotifId, dueDateNotifId } =
        await notificationService.schedulePaymentReminderNotifications(
          paymentId,
          dueDate,
          amount,
          postTitle,
          tenantName,
          landlordName,
          landlordId,
          tenantId
        );

      // Store notification IDs in database
      const { error } = await supabase
        .from('payments')
        .update({
          notification_3day_id: threeDayNotifId,
          notification_1day_id: oneDayNotifId,
          notification_duedate_id: dueDateNotifId,
        })
        .eq('id', paymentId);

      if (error) {
        console.error('Error storing notification IDs:', error);
      } else {
        console.log('✅ Notification IDs stored for payment:', paymentId);
      }
    } catch (error) {
      console.error('Error scheduling payment notifications:', error);
    }
  },

  /**
   * Cancel all scheduled notifications for a payment
   */
  async cancelPaymentNotifications(paymentId: string, supabase: SupabaseClient<Database>) {
    try {
      // Get notification IDs from database
      const { data: payment } = await supabase
        .from('payments')
        .select('notification_3day_id, notification_1day_id, notification_duedate_id')
        .eq('id', paymentId)
        .single();

      if (payment) {
        await notificationService.cancelPaymentNotifications(
          payment.notification_3day_id,
          payment.notification_1day_id,
          payment.notification_duedate_id
        );

        // Clear notification IDs from database
        await supabase
          .from('payments')
          .update({
            notification_3day_id: null,
            notification_1day_id: null,
            notification_duedate_id: null,
          })
          .eq('id', paymentId);

        console.log('✅ Cancelled notifications for payment:', paymentId);
      }
    } catch (error) {
      console.error('Error cancelling payment notifications:', error);
    }
  },
};
