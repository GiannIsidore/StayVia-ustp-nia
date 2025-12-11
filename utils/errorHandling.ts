/**
 * Utility functions for handling database and API errors
 */

interface DatabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Parse PostgreSQL error codes and return user-friendly messages
 */
export function getReadableErrorMessage(error: any): string {
  // Handle null/undefined
  if (!error) return 'An unknown error occurred';

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase/PostgreSQL errors
  if (typeof error === 'object' && error.code) {
    const pgError = error as DatabaseError;

    switch (pgError.code) {
      case '23505': // unique_violation
        // Extract which field caused the duplicate
        if (pgError.message?.includes('email')) {
          return 'This email address is already registered. Please sign in instead.';
        }
        if (pgError.message?.includes('username')) {
          return 'This username is already taken. Please choose a different one.';
        }
        return 'This record already exists. Please use different information.';

      case '23503': // foreign_key_violation
        return 'Invalid reference. Please check your input and try again.';

      case '23502': // not_null_violation
        return 'Required field is missing. Please fill in all required information.';

      case '22P02': // invalid_text_representation
        return 'Invalid data format. Please check your input.';

      case '42501': // insufficient_privilege
        return 'You do not have permission to perform this action.';

      case '53300': // too_many_connections
        return 'Server is busy. Please try again in a moment.';

      case 'PGRST116': // Supabase: Row not found
        return 'Record not found. It may have been deleted.';

      case '08006': // connection_failure
      case '08001': // sqlclient_unable_to_establish_sqlconnection
        return 'Unable to connect to the server. Please check your internet connection.';

      default:
        // If we have a message, use it
        if (pgError.message) {
          return `Database error: ${pgError.message}`;
        }
        return 'A database error occurred. Please try again.';
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle network errors
  if (error?.message?.toLowerCase().includes('network')) {
    return 'Network error. Please check your internet connection.';
  }

  if (error?.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Fallback
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is a duplicate key error
 */
export function isDuplicateError(error: any): boolean {
  return error?.code === '23505';
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const errorStr = JSON.stringify(error).toLowerCase();
  return (
    errorStr.includes('network') ||
    errorStr.includes('timeout') ||
    errorStr.includes('connection') ||
    error?.code === '08006' ||
    error?.code === '08001'
  );
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: any): boolean {
  return error?.code === '42501' || error?.message?.toLowerCase().includes('permission');
}

/**
 * Log error with context for debugging
 */
export function logError(context: string, error: any) {
  console.error(`[${context}] Error:`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    full: error,
  });
}
