import { createClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';
import { checkStudentEligibility } from '~/utils/supabase.server';
import { siteConfig } from '~/config/site';
import {EligibilityStatus, StudentPaymentDetail} from '~/types/payment';

// Types for the reusable payment eligibility service
export interface IndividualSessionInfo {
  totalPurchased: number;
  totalRemaining: number;
  purchases: Array<{
    id: string;
    purchaseDate: string;
    quantityPurchased: number;
    quantityRemaining: number;
  }>;
}

/*export interface StudentPaymentDetail {
  studentId: string;
  familyId: string;
  firstName: string;
  lastName: string;
  eligibility: EligibilityStatus;
  needsPayment: boolean;
  nextPaymentAmount: number;
  nextPaymentTierLabel: string;
  // nextPaymentPriceId: string;
  pastPaymentCount: number;
  individualSessions?: IndividualSessionInfo;
}*/

export interface PaymentEligibilityData {
  familyId: string;
  familyName?: string;
  studentPaymentDetails: StudentPaymentDetail[];
  hasAvailableDiscounts: boolean;
  error?: string;
}

/**
 * Fetches individual session information for a family
 */
export async function getFamilyIndividualSessions(
  familyId: string,
  supabaseClient: ReturnType<typeof createClient<Database>>
): Promise<IndividualSessionInfo> {
  try {
    const { data: sessionsData, error: sessionsError } = await supabaseClient
      .from('one_on_one_sessions')
      .select('id, purchase_date, quantity_purchased, quantity_remaining')
      .eq('family_id', familyId)
      .order('purchase_date', { ascending: false });

    if (sessionsError) {
      console.error('Failed to load individual sessions:', sessionsError.message);
      return {
        totalPurchased: 0,
        totalRemaining: 0,
        purchases: []
      };
    }

    const purchases = (sessionsData || []).map(session => ({
      id: session.id,
      purchaseDate: session.purchase_date,
      quantityPurchased: session.quantity_purchased,
      quantityRemaining: session.quantity_remaining
    }));

    const totalPurchased = purchases.reduce((sum, p) => sum + p.quantityPurchased, 0);
    const totalRemaining = purchases.reduce((sum, p) => sum + p.quantityRemaining, 0);

    return {
      totalPurchased,
      totalRemaining,
      purchases
    };
  } catch (error) {
    console.error('Unexpected error fetching individual sessions:', error);
    return {
      totalPurchased: 0,
      totalRemaining: 0,
      purchases: []
    };
  }
}

/**
 * Fetches payment eligibility data for a family
 * This function extracts the core logic from the family payment page loader
 * and makes it reusable for both family and student-specific payment pages
 */
export async function getFamilyPaymentEligibilityData(
  familyId: string,
  supabaseClient: ReturnType<typeof createClient<Database>>
): Promise<PaymentEligibilityData> {
  try {
    // 1. Fetch Family Name
    const { data: familyData, error: familyError } = await supabaseClient
      .from('families')
      .select('name')
      .eq('id', familyId)
      .single() as { data: { name: string | null } | null, error: Error };

    if (familyError || !familyData) {
      console.error('Payment Eligibility Error: Failed to load family name', familyError?.message);
      return {
        familyId,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load family details.'
      };
    }
    const familyName: string = familyData.name!;

    // 2. Fetch Students for the Family
    const { data: studentsData, error: studentsError } = await supabaseClient
      .from('students')
      .select('id::text, first_name::text, last_name::text')
      .eq('family_id', familyId);

    if (studentsError) {
      console.error('Payment Eligibility Error: Failed to load students', studentsError.message);
      return {
        familyId,
        familyName,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load student information.'
      };
    }
    
    if (!studentsData || studentsData.length === 0) {
      return {
        familyId,
        familyName,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'No students found in this family.'
      };
    }
    const students = studentsData;

    // 3. Fetch Successful Payments for the Family
    const { data: paymentsData, error: paymentsError } = await supabaseClient
      .from('payments')
      .select('id, status')
      .eq('family_id', familyId)
      .eq('status', 'succeeded');

    if (paymentsError) {
      console.error('Payment Eligibility Error: Failed to load payments', paymentsError.message);
      return {
        familyId,
        familyName,
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load payment history.'
      };
    }
    const successfulPaymentIds = paymentsData?.map(p => p.id) || [];

    // 4. Fetch Payment-Student Links for Successful Payments
    let paymentStudentLinks: Array<{ student_id: string, payment_id: string }> = [];
    if (successfulPaymentIds.length > 0) {
      const { data: linksData, error: linksError } = await supabaseClient
        .from('payment_students')
        .select('student_id, payment_id')
        .in('payment_id', successfulPaymentIds) as {
        data: Array<{ student_id: string, payment_id: string }> | null,
        error: Error
      };

      if (linksError) {
        console.error('Payment Eligibility Error: Failed to load payment links', linksError.message);
        return {
          familyId,
          familyName,
          studentPaymentDetails: [],
          hasAvailableDiscounts: false,
          error: 'Could not load payment link history.'
        };
      }
      paymentStudentLinks = linksData || [];
    }

    // 5. Get individual sessions for the family
    const individualSessions = await getFamilyIndividualSessions(familyId, supabaseClient);

    // 6. Calculate Eligibility and Next Payment Details Per Student
    const studentPaymentDetails: StudentPaymentDetail[] = [];

    for (const student of students) {
      // Check current eligibility
      const eligibility : EligibilityStatus = await checkStudentEligibility(student.id, supabaseClient);

      // Determine next payment amount - using flat monthly rate
      const pastPaymentCount = paymentStudentLinks.filter(link => link.student_id === student.id).length;
      const nextPaymentAmount = siteConfig.pricing.monthly;
      const nextPaymentTierLabel = 'Monthly';
      // const nextPaymentPriceId = siteConfig.stripe.priceIds.monthly;

      // Determine if group class payment is needed now
      // Trial students can make payment to upgrade, expired students need payment
      const needsPayment = eligibility.reason === 'Trial' || eligibility.reason === 'Expired';

      studentPaymentDetails.push({
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        eligibility: eligibility,
        needsPayment: needsPayment,
        nextPaymentAmount: nextPaymentAmount,
        nextPaymentTierLabel: nextPaymentTierLabel,
        // nextPaymentPriceId: nextPaymentPriceId,
        pastPaymentCount: pastPaymentCount,
        individualSessions: individualSessions,
      });
    }

    // 7. Check for Available Discounts
    const { data: availableDiscountsData, error: discountsError } = await supabaseClient
      .from('discount_codes')
      .select('id')
      .eq('is_active', true)
      .or(`family_id.eq.${familyId},family_id.is.null`)
      .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString())
      .limit(1);

    const hasAvailableDiscounts = !discountsError && availableDiscountsData && availableDiscountsData.length > 0;

    return {
      familyId,
      familyName,
      studentPaymentDetails,
      hasAvailableDiscounts
    };
  } catch (error) {
    console.error('Payment Eligibility Error: Unexpected error', error);
    return {
      familyId,
      studentPaymentDetails: [],
      hasAvailableDiscounts: false,
      error: 'An unexpected error occurred while loading payment information.'
    };
  }
}

/**
 * Fetches payment eligibility data for a specific student
 * This is useful for student-specific payment pages
 */
export async function getStudentPaymentEligibilityData(
  studentId: string,
  supabaseClient: ReturnType<typeof createClient<Database>>
): Promise<PaymentEligibilityData> {
  try {
    // 1. Fetch student and family information
    const { data: studentData, error: studentError } = await supabaseClient
      .from('students')
      .select('id, first_name, last_name, family_id')
      .eq('id', studentId)
      .single();

    if (studentError || !studentData) {
      console.error('Student Payment Eligibility Error: Failed to load student', studentError?.message);
      return {
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Could not load student information.'
      };
    }

    const familyId = studentData.family_id;
    if (!familyId) {
      return {
        familyId: '',
        studentPaymentDetails: [],
        hasAvailableDiscounts: false,
        error: 'Student is not associated with a family.'
      };
    }

    // 2. Get family payment eligibility data and filter for this student
    const familyData = await getFamilyPaymentEligibilityData(familyId, supabaseClient);
    
    if (familyData.error) {
      return familyData;
    }

    // 3. Filter student payment details for the specific student
    const studentPaymentDetails = familyData.studentPaymentDetails.filter(
      detail => detail.studentId === studentId
    );

    return {
      ...familyData,
      studentPaymentDetails
    };
  } catch (error) {
    console.error('Student Payment Eligibility Error: Unexpected error', error);
    return {
      familyId: '',
      studentPaymentDetails: [],
      hasAvailableDiscounts: false,
      error: 'An unexpected error occurred while loading student payment information.'
    };
  }
}

/**
 * Helper function to get family ID from user profile
 * This is commonly needed in loaders that use the payment eligibility service
 */
export async function getFamilyIdFromUser(
  userId: string,
  supabaseClient: ReturnType<typeof createClient<Database>>
): Promise<{ familyId: string | null; error?: string }> {
  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('family_id')
      .eq('id', userId)
      .single() as { data: { family_id: string | null } | null, error: Error };

    if (profileError || !profileData?.family_id) {
      console.error('Failed to load profile or family_id', profileError?.message);
      return {
        familyId: null,
        error: 'Could not load your family information. Please try again.'
      };
    }

    return { familyId: profileData.family_id };
  } catch (error) {
    console.error('Unexpected error getting family ID from user', error);
    return {
      familyId: null,
      error: 'An unexpected error occurred while loading your family information.'
    };
  }
}