#!/usr/bin/env npx ts-node
/**
 * Test Payment Calendar Script
 * Creates test payments for the current month to test the payment calendar
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test user IDs (these should be real users in your database)
const LANDLORD_ID = 'user_365Jkq3XAgOnoD45XroKKYzzpj8';
const TENANT_ID = 'user_365ztK5xsgqSYiYUcl6fvVe4U2t';

async function createTestPayments() {
  console.log('\n📝 Creating test payments for payment calendar...\n');

  try {
    // Create a test post first
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: LANDLORD_ID,
        title: 'Test Property for Payment Calendar',
        description: 'Testing payment calendar due dates',
        location: 'Test City',
        price_per_night: 1500,
        beds: '2 Bedrooms',
        availability: true,
      })
      .select()
      .single();

    if (postError) throw postError;
    console.log('✅ Test post created:', post.id);

    // Create a test rental request
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
    const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0); // End of month, 3 months later

    const { data: request, error: requestError } = await supabase
      .from('requests')
      .insert({
        post_id: post.id,
        user_id: TENANT_ID,
        rental_start_date: startDate.toISOString(),
        rental_end_date: endDate.toISOString(),
        confirmed: true,
        monthly_rent_amount: 1500,
        payment_day_of_month: 15, // 15th of each month
      })
      .select()
      .single();

    if (requestError) throw requestError;
    console.log('✅ Test rental request created:', request.id);

    // Create multiple payments for different dates in the current month
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const paymentDates = [
      new Date(currentYear, currentMonth, 5), // 5th of current month
      new Date(currentYear, currentMonth, 15), // 15th of current month
      new Date(currentYear, currentMonth, 25), // 25th of current month
    ];

    for (let i = 0; i < paymentDates.length; i++) {
      const paymentDate = paymentDates[i];
      const status = ['unpaid', 'paid', 'overdue'][i];

      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          request_id: request.id,
          landlord_id: LANDLORD_ID,
          tenant_id: TENANT_ID,
          post_id: post.id,
          amount: 1500,
          due_date: paymentDate.toISOString().split('T')[0],
          status: status,
          payment_date: status === 'paid' ? paymentDate.toISOString().split('T')[0] : null,
          payment_method: status === 'paid' ? 'Bank Transfer' : null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;
      console.log(
        `✅ Payment created for ${paymentDate.toDateString()}:`,
        payment.id,
        `(${status})`
      );
    }

    console.log('\n🎯 Test payments ready!\n');
    console.log('📱 Now open the payment calendar as the landlord');
    console.log('   You should see 3 payments with different due dates:');
    console.log('   - 5th of current month (unpaid)');
    console.log('   - 15th of current month (paid)');
    console.log('   - 25th of current month (overdue)');
    console.log('\n   Check the console logs for payment data and formatted dates!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestPayments().then(() => process.exit(0));
