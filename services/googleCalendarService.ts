import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PaymentDate {
  date: Date;
  amount: number;
  rentalId: string;
  propertyTitle: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  location?: string;
  reminders?: Calendar.Reminder[];
}

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class GoogleCalendarService {
  private static instance: GoogleCalendarService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private readonly TOKEN_STORAGE_KEY = 'google_calendar_tokens';
  private readonly CALENDAR_ID_STORAGE_KEY = 'google_calendar_id';

  static getInstance(): GoogleCalendarService {
    if (!GoogleCalendarService.instance) {
      GoogleCalendarService.instance = new GoogleCalendarService();
    }
    return GoogleCalendarService.instance;
  }

  // Initialize with Google OAuth credentials
  private getConfig(): GoogleCalendarConfig {
    return {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET || '',
      redirectUri:
        process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:8081/auth/google/callback',
    };
  }

  // Check if calendar permissions are granted
  async checkCalendarPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking calendar permissions:', error);
      return false;
    }
  }

  // Request calendar permissions
  async requestCalendarPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting calendar permissions:', error);
      return false;
    }
  }

  // Get default calendar ID or create a new one
  async getDefaultCalendarId(): Promise<string> {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

      // Try to find existing StayVia calendar
      const stayViaCalendar = calendars.find((cal: any) => cal.title === 'StayVia Payments');
      if (stayViaCalendar) {
        await AsyncStorage.setItem(this.CALENDAR_ID_STORAGE_KEY, stayViaCalendar.id);
        return stayViaCalendar.id;
      }

      // Create new StayVia calendar
      const newCalendarId = await Calendar.createCalendarAsync({
        title: 'StayVia Payments',
        color: '#2563EB',
        entityType: Calendar.EntityTypes.EVENT,
        source: {
          isLocalAccount: true,
          name: 'StayVia',
          type: Calendar.SourceType.LOCAL,
        },
        name: 'StayVia Payments',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
        ownerAccount: 'local',
      });

      await AsyncStorage.setItem(this.CALENDAR_ID_STORAGE_KEY, newCalendarId);
      return newCalendarId;
    } catch (error) {
      console.error('Error getting/creating calendar:', error);
      throw error;
    }
  }

  // Create a payment reminder event
  async createPaymentEvent(paymentData: PaymentDate): Promise<string> {
    try {
      const hasPermission = await this.checkCalendarPermissions();
      if (!hasPermission) {
        const granted = await this.requestCalendarPermissions();
        if (!granted) {
          throw new Error('Calendar permissions not granted');
        }
      }

      const calendarId = await this.getDefaultCalendarId();

      const eventId = await Calendar.createEventAsync(calendarId, {
        title: `Rent Payment - ${paymentData.propertyTitle}`,
        startDate: paymentData.date,
        endDate: new Date(paymentData.date.getTime() + 30 * 60 * 1000), // 30 minutes duration
        notes: `Monthly rent payment of ₱${paymentData.amount.toLocaleString()} for ${paymentData.propertyTitle}\nRental ID: ${paymentData.rentalId}`,
        alarms: [
          {
            relativeOffset: -1440, // 1 day before
          },
          {
            relativeOffset: -60, // 1 hour before
          },
          {
            relativeOffset: 0, // At the time of event
          },
        ],
      });

      console.log('Created calendar event:', eventId);
      return eventId;
    } catch (error) {
      console.error('Error creating payment event:', error);
      throw error;
    }
  }

  // Create multiple payment events for a rental
  async createRentalPaymentEvents(
    rentalId: string,
    propertyTitle: string,
    paymentDates: Date[],
    amount: number
  ): Promise<string[]> {
    try {
      const eventIds: string[] = [];

      for (const date of paymentDates) {
        const eventId = await this.createPaymentEvent({
          date,
          amount,
          rentalId,
          propertyTitle,
        });
        eventIds.push(eventId);
      }

      // Store mapping of rental to events for future reference
      await this.storeRentalEventMapping(rentalId, eventIds);

      return eventIds;
    } catch (error) {
      console.error('Error creating rental payment events:', error);
      throw error;
    }
  }

  // Update an existing event
  async updateEvent(eventId: string, updates: Partial<Calendar.Event>): Promise<void> {
    try {
      await Calendar.updateEventAsync(eventId, updates);
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  // Delete an event
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await Calendar.deleteEventAsync(eventId);
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  // Delete all events for a rental
  async deleteRentalEvents(rentalId: string): Promise<void> {
    try {
      const eventIds = await this.getRentalEventIds(rentalId);

      for (const eventId of eventIds) {
        await this.deleteEvent(eventId);
      }

      // Remove mapping
      await this.removeRentalEventMapping(rentalId);
    } catch (error) {
      console.error('Error deleting rental events:', error);
      throw error;
    }
  }

  // Get events for a specific date range
  async getEventsForDateRange(startDate: Date, endDate: Date): Promise<Calendar.Event[]> {
    try {
      const calendarId = await this.getDefaultCalendarId();
      const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);
      return events;
    } catch (error) {
      console.error('Error getting events for date range:', error);
      return [];
    }
  }

  // Store rental to event mapping
  private async storeRentalEventMapping(rentalId: string, eventIds: string[]): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('rental_event_mappings');
      const mappings = existing ? JSON.parse(existing) : {};
      mappings[rentalId] = eventIds;
      await AsyncStorage.setItem('rental_event_mappings', JSON.stringify(mappings));
    } catch (error) {
      console.error('Error storing rental event mapping:', error);
    }
  }

  // Get event IDs for a rental
  private async getRentalEventIds(rentalId: string): Promise<string[]> {
    try {
      const existing = await AsyncStorage.getItem('rental_event_mappings');
      const mappings = existing ? JSON.parse(existing) : {};
      return mappings[rentalId] || [];
    } catch (error) {
      console.error('Error getting rental event IDs:', error);
      return [];
    }
  }

  // Remove rental event mapping
  private async removeRentalEventMapping(rentalId: string): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem('rental_event_mappings');
      const mappings = existing ? JSON.parse(existing) : {};
      delete mappings[rentalId];
      await AsyncStorage.setItem('rental_event_mappings', JSON.stringify(mappings));
    } catch (error) {
      console.error('Error removing rental event mapping:', error);
    }
  }

  // Check if rental has calendar events
  async hasRentalEvents(rentalId: string): Promise<boolean> {
    const eventIds = await this.getRentalEventIds(rentalId);
    return eventIds.length > 0;
  }

  // Get sync status for a rental
  async getRentalSyncStatus(rentalId: string): Promise<'synced' | 'partial' | 'none'> {
    const eventIds = await this.getRentalEventIds(rentalId);

    if (eventIds.length === 0) {
      return 'none';
    }

    // Check if all events still exist
    try {
      const calendarId = await this.getDefaultCalendarId();
      const now = new Date();
      const futureDate = new Date(now.getFullYear() + 1, 0, 1);
      const events = await Calendar.getEventsAsync([calendarId], now, futureDate);

      const existingEventIds = events.map((event: any) => event.id);
      const existingCount = eventIds.filter((id) => existingEventIds.includes(id)).length;

      if (existingCount === eventIds.length) {
        return 'synced';
      } else if (existingCount > 0) {
        return 'partial';
      } else {
        return 'none';
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      return 'none';
    }
  }
}

export const googleCalendarService = GoogleCalendarService.getInstance();
