export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      admins: {
        Row: {
          avatar: string | null;
          created_at: string;
          email: string | null;
          firstname: string | null;
          id: string;
          lastname: string | null;
          role: string | null;
          user_id: string | null;
        };
        Insert: {
          avatar?: string | null;
          created_at?: string;
          email?: string | null;
          firstname?: string | null;
          id?: string;
          lastname?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Update: {
          avatar?: string | null;
          created_at?: string;
          email?: string | null;
          firstname?: string | null;
          id?: string;
          lastname?: string | null;
          role?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      contact_support: {
        Row: {
          created_at: string;
          email: string | null;
          id: number;
          message: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: number;
          message?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: number;
          message?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'contact_support_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string | null;
          created_at: string;
          id: string;
          user_id: string | null;
        };
        Insert: {
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_participants_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversation_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          created_at: string | null;
          favorited: boolean | null;
          id: string;
          post_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          favorited?: boolean | null;
          id?: string;
          post_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          favorited?: boolean | null;
          id?: string;
          post_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          image_path: string | null;
          sender_id: string | null;
        };
        Insert: {
          content?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          sender_id?: string | null;
        };
        Update: {
          content?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          availability: boolean | null;
          beds: string | null;
          created_at: string | null;
          description: string | null;
          filters: Json | null;
          id: string;
          image: string | null;
          latitude: number | null;
          location: string | null;
          longitude: number | null;
          max_occupancy: number;
          price_per_night: number | null;
          title: string;
          user_id: string | null;
        };
        Insert: {
          availability?: boolean | null;
          beds?: string | null;
          created_at?: string | null;
          description?: string | null;
          filters?: Json | null;
          id?: string;
          image?: string | null;
          latitude?: number | null;
          location?: string | null;
          longitude?: number | null;
          max_occupancy?: number;
          price_per_night?: number | null;
          title: string;
          user_id?: string | null;
        };
        Update: {
          availability?: boolean | null;
          beds?: string | null;
          created_at?: string | null;
          description?: string | null;
          filters?: Json | null;
          id?: string;
          image?: string | null;
          latitude?: number | null;
          location?: string | null;
          longitude?: number | null;
          max_occupancy?: number;
          price_per_night?: number | null;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          ratee_id: string;
          rater_id: string;
          score: number;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          ratee_id: string;
          rater_id: string;
          score: number;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          ratee_id?: string;
          rater_id?: string;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'ratings_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_ratee_id_fkey';
            columns: ['ratee_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ratings_rater_id_fkey';
            columns: ['rater_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      requests: {
        Row: {
          confirmed: boolean | null;
          confirmed_at: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          requested: boolean | null;
          updated_at: string | null;
          user_id: string | null;
          rental_start_date: string | null;
          rental_end_date: string | null;
          monthly_rent_amount: number | null;
          payment_day_of_month: number | null;
          rating_notif_sent: boolean;
          rating_notif_sent_at: string | null;
        };
        Insert: {
          confirmed?: boolean | null;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          requested?: boolean | null;
          updated_at?: string | null;
          user_id?: string | null;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          monthly_rent_amount?: number | null;
          payment_day_of_month?: number | null;
          rating_notif_sent?: boolean;
          rating_notif_sent_at?: string | null;
        };
        Update: {
          confirmed?: boolean | null;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          requested?: boolean | null;
          updated_at?: string | null;
          user_id?: string | null;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          monthly_rent_amount?: number | null;
          payment_day_of_month?: number | null;
          rating_notif_sent?: boolean;
          rating_notif_sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'requests_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'requests_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          request_id: string;
          landlord_id: string;
          tenant_id: string;
          post_id: string;
          amount: number;
          due_date: string;
          payment_date: string | null;
          status: string;
          notes: string | null;
          payment_method: string | null;
          created_at: string;
          updated_at: string;
          reminder_3day_sent: boolean;
          reminder_1day_sent: boolean;
          reminder_duedate_sent: boolean;
          overdue_notif_sent: boolean;
          notification_3day_id: string | null;
          notification_1day_id: string | null;
          notification_duedate_id: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          landlord_id: string;
          tenant_id: string;
          post_id: string;
          amount: number;
          due_date: string;
          payment_date?: string | null;
          status?: string;
          notes?: string | null;
          payment_method?: string | null;
          created_at?: string;
          updated_at?: string;
          reminder_3day_sent?: boolean;
          reminder_1day_sent?: boolean;
          reminder_duedate_sent?: boolean;
          overdue_notif_sent?: boolean;
          notification_3day_id?: string | null;
          notification_1day_id?: string | null;
          notification_duedate_id?: string | null;
        };
        Update: {
          id?: string;
          request_id?: string;
          landlord_id?: string;
          tenant_id?: string;
          post_id?: string;
          amount?: number;
          due_date?: string;
          payment_date?: string | null;
          status?: string;
          notes?: string | null;
          payment_method?: string | null;
          created_at?: string;
          updated_at?: string;
          reminder_3day_sent?: boolean;
          reminder_1day_sent?: boolean;
          reminder_duedate_sent?: boolean;
          overdue_notif_sent?: boolean;
          notification_3day_id?: string | null;
          notification_1day_id?: string | null;
          notification_duedate_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_request_id_fkey';
            columns: ['request_id'];
            isOneToOne: false;
            referencedRelation: 'requests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_landlord_id_fkey';
            columns: ['landlord_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          account_type: string | null;
          avatar: string | null;
          contact: number | null;
          created_at: string | null;
          email: string;
          firstname: string | null;
          id: string;
          landlord_proof_id: string | null;
          lastname: string | null;
          online: boolean | null;
          school: string | null;
          student_id: number | null;
          student_proof_id: string | null;
          suspended: string | null;
          username: string | null;
          verified_at: string | null;
        };
        Insert: {
          account_type?: string | null;
          avatar?: string | null;
          contact?: number | null;
          created_at?: string | null;
          email: string;
          firstname?: string | null;
          id: string;
          landlord_proof_id?: string | null;
          lastname?: string | null;
          online?: boolean | null;
          school?: string | null;
          student_id?: number | null;
          student_proof_id?: string | null;
          suspended?: string | null;
          username?: string | null;
          verified_at?: string | null;
        };
        Update: {
          account_type?: string | null;
          avatar?: string | null;
          contact?: number | null;
          created_at?: string | null;
          email?: string;
          firstname?: string | null;
          id?: string;
          landlord_proof_id?: string | null;
          lastname?: string | null;
          online?: boolean | null;
          school?: string | null;
          student_id?: number | null;
          student_proof_id?: string | null;
          suspended?: string | null;
          username?: string | null;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      verify_account: {
        Row: {
          created_at: string;
          id: string;
          reject_msg: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reject_msg?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          reject_msg?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'verify_account_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      requesting_user_id: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

// Custom type for post occupancy tracking
export type PostOccupancy = {
  post_id: string;
  title: string;
  max_occupancy: number;
  current_occupancy: number;
  available_slots: number;
  has_available_slots: boolean;
};
