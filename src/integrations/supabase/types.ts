export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          category_id: string;
          created_at: string;
          emoji: string;
          family_id: string | null;
          id: string;
          is_favorite: boolean;
          name: string;
          points: number | null;
          sort_order: number;
          subcategory: string | null;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          emoji?: string;
          family_id?: string | null;
          id?: string;
          is_favorite?: boolean;
          name: string;
          points?: number | null;
          sort_order?: number;
          subcategory?: string | null;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          emoji?: string;
          family_id?: string | null;
          id?: string;
          is_favorite?: boolean;
          name?: string;
          points?: number | null;
          sort_order?: number;
          subcategory?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activities_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          family_id: string | null;
          icon: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          family_id?: string | null;
          icon?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          family_id?: string | null;
          icon?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      children: {
        Row: {
          color: string;
          created_at: string;
          emoji: string;
          family_id: string | null;
          id: string;
          name: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          emoji?: string;
          family_id?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          emoji?: string;
          family_id?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "children_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      families: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          points_enabled: boolean;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          points_enabled?: boolean;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          points_enabled?: boolean;
        };
        Relationships: [];
      };
      rewards: {
        Row: {
          created_at: string;
          description: string | null;
          family_id: string;
          id: string;
          name: string;
          points_required: number;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          family_id: string;
          id?: string;
          name: string;
          points_required: number;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          family_id?: string;
          id?: string;
          name?: string;
          points_required?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      family_access_tokens: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          last_used_at: string | null;
          revoked_at: string | null;
          token: string;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token: string;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_access_tokens_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      family_members: {
        Row: {
          created_at: string;
          family_id: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          family_id: string;
          id?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          family_id?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      family_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          family_id: string;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          family_id: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          family_id?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey";
            columns: ["family_id"];
            isOneToOne: false;
            referencedRelation: "families";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      bucket_items: {
        Row: {
          child_id: string;
          created_at: string;
          done: boolean;
          done_at: string | null;
          emoji: string;
          id: string;
          sort_order: number;
          title: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          done?: boolean;
          done_at?: string | null;
          emoji?: string;
          id?: string;
          sort_order?: number;
          title: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          done?: boolean;
          done_at?: string | null;
          emoji?: string;
          id?: string;
          sort_order?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bucket_items_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
        ];
      };
      completions: {
        Row: {
          activity_id: string;
          child_id: string;
          completed_at: string;
          completed_date: string;
          id: string;
        };
        Insert: {
          activity_id: string;
          child_id: string;
          completed_at?: string;
          completed_date?: string;
          id?: string;
        };
        Update: {
          activity_id?: string;
          child_id?: string;
          completed_at?: string;
          completed_date?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "completions_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "completions_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_family_invite: {
        Args: { p_token: string };
        Returns: string;
      };
      clone_catalog_for_family: {
        Args: { p_family: string };
        Returns: undefined;
      };
      get_invite_preview: {
        Args: { p_token: string };
        Returns: {
          family_name: string;
          inviter_email: string;
          invite_email: string;
          status: string;
          expired: boolean;
        }[];
      };
      is_family_member: {
        Args: { p_family: string };
        Returns: boolean;
      };
      is_family_owner: {
        Args: { p_family: string };
        Returns: boolean;
      };
      list_family_members: {
        Args: { p_family: string };
        Returns: {
          id: string;
          user_id: string;
          role: string;
          email: string | null;
          created_at: string;
          is_self: boolean;
        }[];
      };
      redeem_family_token: {
        Args: { p_token: string };
        Returns: string;
      };
      remove_family_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
