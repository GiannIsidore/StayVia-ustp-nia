import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { paymentService } from './paymentService';

// ---------------------------
// INSERT REQUEST BY USER ID
// ---------------------------
export const insertRequestByUserId = async (
  userId: string,
  postId: string,
  supabase: SupabaseClient<Database>
) => {
  const { data, error } = await supabase
    .from('requests')
    .insert({
      user_id: userId,
      post_id: postId,
    })
    .select('*'); // select inserted row(s)

  if (error) throw error;
  return data ?? [];
};

// ---------------------------
// FETCH REQUESTS BY USER ID
// Optional: filter by postId if provided
// ---------------------------
export const fetchRequestByUserId = async (
  userId: string,
  postId: string | null,
  supabase: SupabaseClient<Database>
) => {
  let query = supabase
    .from('requests')
    .select('*, post:posts(*, post_user:users(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (postId) query = query.eq('post_id', postId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

// ---------------------------
// FETCH ALL REQUESTS FOR A POST
// Useful to disable request button for everyone
// ---------------------------
export const fetchAllRequestsByPostId = async (
  postId: string,
  supabase: SupabaseClient<Database>
) => {
  const { data, error } = await supabase.from('requests').select('*').eq('post_id', postId);

  if (error) throw error;
  return data ?? [];
};

// DELETE/DISAPPROVE REQUEST
export const deleteRequest = async (id: string, supabase: SupabaseClient<Database>) => {
  const { error } = await supabase.from('requests').delete().eq('id', id);

  if (error) throw error;
  return true;
};

// requestService.ts
export const updateRequest = async (
  requestId: string,
  supabase: SupabaseClient<Database>,
  startDate?: Date,
  endDate?: Date,
  paymentDay?: number
) => {
  // Get current state first
  const { data: existing, error: fetchError } = await supabase
    .from('requests')
    .select(
      'id, user_id, post_id, requested, confirmed, rental_start_date, rental_end_date, payment_day_of_month, monthly_rent_amount'
    )
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!existing) throw new Error('Request not found');

  let updateData: any = {};

  // Get the post's price_per_night if we need to populate monthly_rent_amount
  let pricePerNight = 0;
  let landlordId = '';
  if (!existing.monthly_rent_amount && existing.post_id) {
    const { data: post } = await supabase
      .from('posts')
      .select('price_per_night, user_id')
      .eq('id', existing.post_id)
      .single();

    if (post) {
      pricePerNight = post.price_per_night || 0;
      landlordId = post.user_id || '';
    }
  }

  // Logic:
  // 1️⃣ If not requested yet → mark requested = true (acknowledge)
  // 2️⃣ If requested but not confirmed yet → mark confirmed = true (approve with dates)
  // 3️⃣ If already confirmed but missing rental dates → populate them now
  if (!existing.requested) {
    updateData = { requested: true };
  } else if (!existing.confirmed) {
    // When confirming, use provided dates OR fall back to defaults
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setMonth(defaultEnd.getMonth() + 1); // Default 1 month rental

    updateData = {
      confirmed: true,
      rental_start_date:
        startDate?.toISOString() || existing.rental_start_date || now.toISOString(),
      rental_end_date:
        endDate?.toISOString() || existing.rental_end_date || defaultEnd.toISOString(),
      payment_day_of_month: paymentDay || existing.payment_day_of_month || now.getDate(),
      monthly_rent_amount: existing.monthly_rent_amount || pricePerNight || 0,
    };
  } else if (existing.confirmed && (!existing.rental_start_date || !existing.rental_end_date)) {
    // Already confirmed but missing rental dates — populate them now
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setMonth(defaultEnd.getMonth() + 1); // Default 1 month rental

    updateData = {
      rental_start_date:
        startDate?.toISOString() || existing.rental_start_date || now.toISOString(),
      rental_end_date:
        endDate?.toISOString() || existing.rental_end_date || defaultEnd.toISOString(),
      payment_day_of_month: paymentDay || existing.payment_day_of_month || now.getDate(),
      monthly_rent_amount: existing.monthly_rent_amount || pricePerNight || 0,
    };
  } else {
    // already confirmed with rental dates — no more changes
    return existing;
  }

  const { data, error } = await supabase
    .from('requests')
    .update(updateData)
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw error;

  // Create payments if rental is being confirmed and doesn't have payments yet
  const isBeingConfirmed = !existing.confirmed && updateData.confirmed === true;
  if (isBeingConfirmed) {
    try {
      const startDate = updateData.rental_start_date || existing.rental_start_date;
      const endDate = updateData.rental_end_date || existing.rental_end_date;
      const monthlyRent = updateData.monthly_rent_amount || existing.monthly_rent_amount || 0;
      const paymentDay = updateData.payment_day_of_month || existing.payment_day_of_month || 1;

      // Get landlord ID if not already fetched
      if (!landlordId && existing.post_id) {
        const { data: post } = await supabase
          .from('posts')
          .select('user_id')
          .eq('id', existing.post_id)
          .single();
        landlordId = post?.user_id || '';
      }

      if (
        landlordId &&
        startDate &&
        endDate &&
        monthlyRent > 0 &&
        existing.user_id &&
        existing.post_id
      ) {
        await paymentService.createPaymentsForRental(
          requestId,
          landlordId,
          existing.user_id,
          existing.post_id,
          startDate,
          endDate,
          monthlyRent,
          paymentDay,
          supabase
        );
      }
    } catch (paymentError) {
      console.error('Error creating payments for rental:', paymentError);
      // Don't throw - rental confirmation should succeed even if payment creation fails
    }
  }

  return data;
};

// FETCH REQUEST BY USERiD
type RequestWithUser = {
  id: string;
  title: string;
  avatar: string;
  time: string;
  postId: string;
  user: Database['public']['Tables']['users']['Row'];
  requested: boolean;
  post: Database['public']['Tables']['posts']['Row'] & { created_at: string }; // Assuming posts have created_at
  confirmed: boolean;
  created_at: string; // Add created_at for sorting later
  rental_start_date?: string | null;
  rental_end_date?: string | null;
};

export const fetchAllRequests = async (
  postIds: string[],
  supabase: SupabaseClient<Database>
): Promise<RequestWithUser[]> => {
  if (!postIds.length) return [];

  const { data, error } = await supabase
    .from('requests')
    .select(
      `
      *,
      user:user_id (*),
      post:post_id (*)
    `
    )
    .in('post_id', postIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const defaultAvatar = 'https://i.pravatar.cc/150';

  return data.map((r: any) => ({
    id: r.id,
    title: `${r.user?.firstname} requested your post "${r.post?.title}"`,
    avatar: r.user?.avatar || defaultAvatar,
    time: formatDistanceToNow(new Date(r.created_at), { addSuffix: true }),
    postId: r.post?.id,
    post: r.post,
    user: r.user,
    requested: r.requested ?? false,
    confirmed: r.confirmed ?? false,
    created_at: r.created_at, // Included for sorting in the component
    rental_start_date: r.rental_start_date,
    rental_end_date: r.rental_end_date,
  }));
};

// ---------------------------
// FETCH APPROVED REQUESTS FOR A USER
// ---------------------------
export const fetchApprovedRequestsByUser = async (
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<RequestWithUser[]> => {
  const { data, error } = await supabase
    .from('requests')
    .select(
      `
      *,
      user:user_id (*),
      post:post_id (*)
    `
    )
    .eq('confirmed', true) // only approved requests
    .eq('user_id', userId) // only requests by this user
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const defaultAvatar = 'https://i.pravatar.cc/150';

  return data.map((r: any) => ({
    id: r.id,
    title: `${r.user?.firstname} requested your post "${r.post?.title}"`,
    avatar: r.user?.avatar || defaultAvatar,
    time: formatDistanceToNow(new Date(r.created_at), { addSuffix: true }),
    postId: r.post?.id,
    post: r.post,
    user: r.user,
    requested: r.requested ?? false,
    confirmed: r.confirmed ?? false,
    created_at: r.created_at, // Included for sorting
    rental_start_date: r.rental_start_date,
    rental_end_date: r.rental_end_date,
  }));
};

export const fetchRequestsByUser = async (
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<RequestWithUser[]> => {
  const { data, error } = await supabase
    .from('requests')
    .select(`*, user:user_id(*), post:post_id(*)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const defaultAvatar = 'https://i.pravatar.cc/150';

  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: `${r.user?.firstname} requested your post "${r.post?.title}"`,
    avatar: r.user?.avatar || defaultAvatar,
    time: formatDistanceToNow(new Date(r.created_at), { addSuffix: true }),
    postId: r.post?.id,
    post: r.post,
    user: r.user,
    requested: r.requested ?? false,
    confirmed: r.confirmed ?? false,
    created_at: r.created_at, // Included for sorting
    rental_start_date: r.rental_start_date,
    rental_end_date: r.rental_end_date,
  }));
};

// ---------------------------
// RENTAL TRACKING METHODS
// ---------------------------

/**
 * Get rentals due for rating (1 minute passed since rental_start_date)
 */
export const getRentalsDueForRating = async (
  userId: string,
  supabase: SupabaseClient<Database>
) => {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

  const { data, error } = await supabase
    .from('requests')
    .select(
      `
      id,
      rental_start_date,
      rental_end_date,
      monthly_rent_amount,
      payment_day_of_month,
      post:post_id (
        id,
        title,
        price_per_night
      ),
      user:user_id (
        id,
        firstname,
        lastname
      )
    `
    )
    .eq('user_id', userId)
    .eq('confirmed', true)
    .not('rental_start_date', 'is', null)
    .lte('rental_start_date', oneMinuteAgo.toISOString());

  if (error) throw error;
  return data ?? [];
};

/**
 * Get all active rentals for a user
 */
export const getActiveRentals = async (userId: string, supabase: SupabaseClient<Database>) => {
  const now = new Date();

  console.log('🔍 getActiveRentals called with userId:', userId);
  console.log('🔍 Current date:', now.toISOString());

  // First, let's get ALL confirmed rentals for this user to debug
  const { data: allConfirmed } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', userId)
    .eq('confirmed', true);

  console.log('🔍 All confirmed rentals for user:', allConfirmed);

  const { data, error } = await supabase
    .from('requests')
    .select(
      `
      id,
      rental_start_date,
      rental_end_date,
      monthly_rent_amount,
      payment_day_of_month,
      post:post_id (
        id,
        title,
        price_per_night,
        user:user_id (id, firstname, lastname)
      ),
      user:user_id (
        id,
        firstname,
        lastname
      )
    `
    )
    .eq('user_id', userId)
    .eq('confirmed', true)
    .not('rental_start_date', 'is', null)
    .not('rental_end_date', 'is', null)
    .lte('rental_start_date', now.toISOString())
    .gte('rental_end_date', now.toISOString());

  console.log('🔍 getActiveRentals result:', { data, error });

  if (error) throw error;
  return data ?? [];
};

/**
 * Get upcoming rentals for a user (confirmed but not started yet)
 */
export const getUpcomingRentals = async (userId: string, supabase: SupabaseClient<Database>) => {
  const now = new Date();

  const { data, error } = await supabase
    .from('requests')
    .select(
      `
      id,
      rental_start_date,
      rental_end_date,
      monthly_rent_amount,
      payment_day_of_month,
      post:post_id (
        id,
        title,
        price_per_night,
        user:user_id (id, firstname, lastname)
      ),
      user:user_id (
        id,
        firstname,
        lastname
      )
    `
    )
    .eq('user_id', userId)
    .eq('confirmed', true)
    .not('rental_start_date', 'is', null)
    .not('rental_end_date', 'is', null)
    .gt('rental_start_date', now.toISOString()) // Start date is in the future
    .gte('rental_end_date', now.toISOString()) // End date hasn't passed
    .order('rental_start_date', { ascending: true }); // Earliest first

  if (error) throw error;
  return data ?? [];
};

/**
 * Update rental dates when confirming booking
 */
export const updateRentalDates = async (
  requestId: string,
  startDate: Date,
  endDate: Date,
  paymentDayOfMonth: number,
  monthlyAmount: number,
  supabase: SupabaseClient<Database>
) => {
  const { data, error } = await supabase
    .from('requests')
    .update({
      rental_start_date: startDate.toISOString(),
      rental_end_date: endDate.toISOString(),
      payment_day_of_month: paymentDayOfMonth,
      monthly_rent_amount: monthlyAmount,
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Mark rating notification as sent
 */
export const markRatingNotifSent = async (
  requestId: string,
  supabase: SupabaseClient<Database>
) => {
  const { data, error } = await supabase
    .from('requests')
    .update({
      rating_notif_sent: true,
      rating_notif_sent_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

/**
 * Get rentals needing notification (for useRentalNotifications hook)
 */
export const getRentalsNeedingNotification = async (
  userId: string,
  supabase: SupabaseClient<Database>
) => {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);

  const { data, error } = await supabase
    .from('requests')
    .select(
      `
      id,
      rental_start_date,
      rating_notif_sent,
      post:post_id (
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

  if (error) throw error;
  return data ?? [];
};

// ---------------------------
// FETCH ALL ACCOUNT VERIFICATION MESSAGES (Rejection History)
// ---------------------------
// 🚨 MODIFIED FUNCTION TO FETCH ALL MESSAGES
export const fetchAllVerificationMessages = async (
  userId: string,
  supabase: SupabaseClient<Database>
) => {
  const { data, error } = await supabase
    .from('verify_account')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }); // Sort descending (newest rejection first)

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) return [];

  return data.map((d: { reject_msg: string | null; created_at: string | null }) => ({
    reject_msg: d.reject_msg,
    created_at: d.created_at,
    // Safely create Date object for formatting, fall back if created_at is null
    time: formatDistanceToNow(d.created_at ? new Date(d.created_at) : new Date(), {
      addSuffix: true,
    }),
  }));
};
