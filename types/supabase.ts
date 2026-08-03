/**
 * Tipos de la base de datos Supabase — Relojes Carrasco.
 *
 * Este archivo sigue el formato de `supabase gen types typescript`.
 * Regenerar tras cada migración con:  npm run db:types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      application_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cash_accounts: {
        Row: {
          id: string;
          name: string;
          currency: Database["public"]["Enums"]["currency_code"];
          account_type: string;
          initial_balance: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          currency: Database["public"]["Enums"]["currency_code"];
          account_type?: string;
          initial_balance?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          account_type?: string;
          initial_balance?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      cash_transactions: {
        Row: {
          id: string;
          account_id: string;
          transaction_date: string;
          type: Database["public"]["Enums"]["cash_transaction_type"];
          amount: number;
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          payment_id: string | null;
          transfer_group_id: string | null;
          description: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          transaction_date: string;
          type: Database["public"]["Enums"]["cash_transaction_type"];
          amount: number;
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          payment_id?: string | null;
          transfer_group_id?: string | null;
          description?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          transaction_date?: string;
          type?: Database["public"]["Enums"]["cash_transaction_type"];
          amount?: number;
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          payment_id?: string | null;
          transfer_group_id?: string | null;
          description?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          document_id: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          document_id?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          email?: string | null;
          document_id?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          base_currency: Database["public"]["Enums"]["currency_code"];
          quote_currency: Database["public"]["Enums"]["currency_code"];
          buy_rate: number | null;
          sell_rate: number | null;
          rate: number;
          source: string;
          rate_date: string;
          is_manual: boolean;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          base_currency?: Database["public"]["Enums"]["currency_code"];
          quote_currency?: Database["public"]["Enums"]["currency_code"];
          buy_rate?: number | null;
          sell_rate?: number | null;
          rate: number;
          source?: string;
          rate_date: string;
          is_manual?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          kind: Database["public"]["Enums"]["expense_category_kind"];
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          kind: Database["public"]["Enums"]["expense_category_kind"];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          kind?: Database["public"]["Enums"]["expense_category_kind"];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      general_expenses: {
        Row: {
          id: string;
          expense_date: string;
          category_id: string;
          description: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          supplier_id: string | null;
          payment_method: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_paid: number;
          due_date: string | null;
          is_recurring: boolean;
          receipt_path: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          expense_date: string;
          category_id: string;
          description: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          supplier_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          due_date?: string | null;
          is_recurring?: boolean;
          receipt_path?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          expense_date?: string;
          category_id?: string;
          description?: string;
          amount?: number;
          currency?: Database["public"]["Enums"]["currency_code"];
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          supplier_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          due_date?: string | null;
          is_recurring?: boolean;
          receipt_path?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "general_expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "general_expenses_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          transaction_type: Database["public"]["Enums"]["payment_transaction_type"];
          transaction_id: string;
          payment_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          payment_method: string | null;
          cash_account_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          transaction_type: Database["public"]["Enums"]["payment_transaction_type"];
          transaction_id: string;
          payment_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          payment_method?: string | null;
          cash_account_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          transaction_type?: Database["public"]["Enums"]["payment_transaction_type"];
          transaction_id?: string;
          payment_date?: string;
          amount?: number;
          currency?: Database["public"]["Enums"]["currency_code"];
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          payment_method?: string | null;
          cash_account_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_cash_account_id_fkey";
            columns: ["cash_account_id"];
            isOneToOne: false;
            referencedRelation: "cash_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      product_costs: {
        Row: {
          id: string;
          product_id: string;
          category_id: string;
          description: string;
          cost_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          supplier_id: string | null;
          payment_method: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_paid: number;
          due_date: string | null;
          receipt_path: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          category_id: string;
          description?: string;
          cost_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          supplier_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          due_date?: string | null;
          receipt_path?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          category_id?: string;
          description?: string;
          cost_date?: string;
          amount?: number;
          currency?: Database["public"]["Enums"]["currency_code"];
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          supplier_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          due_date?: string | null;
          receipt_path?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_costs_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_costs_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          storage_path: string;
          is_cover: boolean;
          sort_order: number;
          alt_text: string | null;
          width: number | null;
          height: number | null;
          size_bytes: number | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          storage_path: string;
          is_cover?: boolean;
          sort_order?: number;
          alt_text?: string | null;
          width?: number | null;
          height?: number | null;
          size_bytes?: number | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          storage_path?: string;
          is_cover?: boolean;
          sort_order?: number;
          alt_text?: string | null;
          width?: number | null;
          height?: number | null;
          size_bytes?: number | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_price_history: {
        Row: {
          id: string;
          product_id: string;
          old_amount: number | null;
          old_currency: Database["public"]["Enums"]["currency_code"] | null;
          new_amount: number;
          new_currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          new_amount_usd: number;
          new_amount_uyu: number;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          old_amount?: number | null;
          old_currency?: Database["public"]["Enums"]["currency_code"] | null;
          new_amount: number;
          new_currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          new_amount_usd: number;
          new_amount_uyu: number;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_status_history: {
        Row: {
          id: string;
          product_id: string;
          old_status: Database["public"]["Enums"]["product_status"] | null;
          new_status: Database["public"]["Enums"]["product_status"];
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          old_status?: Database["public"]["Enums"]["product_status"] | null;
          new_status: Database["public"]["Enums"]["product_status"];
          note?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "product_status_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          name: string;
          brand: string;
          model: string;
          reference_number: string | null;
          serial_number: string | null;
          slug: string;
          year_approx: number | null;
          movement: Database["public"]["Enums"]["movement_type"];
          case_material: string | null;
          strap_material: string | null;
          diameter_mm: number | null;
          water_resistance: string | null;
          gender: string | null;
          condition: string;
          includes_box: boolean;
          includes_documentation: boolean;
          includes_accessories: string | null;
          public_description: string;
          internal_notes: string | null;
          status: Database["public"]["Enums"]["product_status"];
          is_published: boolean;
          is_featured: boolean;
          published_at: string | null;
          listing_price_amount: number | null;
          listing_price_currency: Database["public"]["Enums"]["currency_code"] | null;
          listing_price_usd: number | null;
          listing_price_uyu: number | null;
          listing_exchange_rate: number | null;
          listing_rate_date: string | null;
          listing_updated_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          brand: string;
          model?: string;
          reference_number?: string | null;
          serial_number?: string | null;
          slug: string;
          year_approx?: number | null;
          movement?: Database["public"]["Enums"]["movement_type"];
          case_material?: string | null;
          strap_material?: string | null;
          diameter_mm?: number | null;
          water_resistance?: string | null;
          gender?: string | null;
          condition?: string;
          includes_box?: boolean;
          includes_documentation?: boolean;
          includes_accessories?: string | null;
          public_description?: string;
          internal_notes?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          is_published?: boolean;
          is_featured?: boolean;
          published_at?: string | null;
          listing_price_amount?: number | null;
          listing_price_currency?: Database["public"]["Enums"]["currency_code"] | null;
          listing_price_usd?: number | null;
          listing_price_uyu?: number | null;
          listing_exchange_rate?: number | null;
          listing_rate_date?: string | null;
          listing_updated_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          brand?: string;
          model?: string;
          reference_number?: string | null;
          serial_number?: string | null;
          slug?: string;
          year_approx?: number | null;
          movement?: Database["public"]["Enums"]["movement_type"];
          case_material?: string | null;
          strap_material?: string | null;
          diameter_mm?: number | null;
          water_resistance?: string | null;
          gender?: string | null;
          condition?: string;
          includes_box?: boolean;
          includes_documentation?: boolean;
          includes_accessories?: string | null;
          public_description?: string;
          internal_notes?: string | null;
          status?: Database["public"]["Enums"]["product_status"];
          is_published?: boolean;
          is_featured?: boolean;
          published_at?: string | null;
          listing_price_amount?: number | null;
          listing_price_currency?: Database["public"]["Enums"]["currency_code"] | null;
          listing_price_usd?: number | null;
          listing_price_uyu?: number | null;
          listing_exchange_rate?: number | null;
          listing_rate_date?: string | null;
          listing_updated_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          product_id: string;
          purchase_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          supplier_id: string | null;
          payment_method: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_paid: number;
          notes: string | null;
          receipt_path: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          purchase_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          supplier_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          notes?: string | null;
          receipt_path?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          purchase_date?: string;
          amount?: number;
          currency?: Database["public"]["Enums"]["currency_code"];
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          supplier_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          notes?: string | null;
          receipt_path?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_expenses: {
        Row: {
          id: string;
          sale_id: string;
          category_id: string;
          description: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_paid: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          sale_id: string;
          category_id: string;
          description?: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          sale_id?: string;
          category_id?: string;
          description?: string;
          amount?: number;
          currency?: Database["public"]["Enums"]["currency_code"];
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_expenses_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_expenses_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          id: string;
          product_id: string;
          sale_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          listing_price_usd_at_sale: number | null;
          customer_id: string | null;
          payment_method: string | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_paid: number;
          due_date: string | null;
          notes: string | null;
          is_cancelled: boolean;
          cancelled_at: string | null;
          cancelled_reason: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          sale_date: string;
          amount: number;
          currency: Database["public"]["Enums"]["currency_code"];
          exchange_rate: number;
          amount_usd: number;
          amount_uyu: number;
          listing_price_usd_at_sale?: number | null;
          customer_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          due_date?: string | null;
          notes?: string | null;
          is_cancelled?: boolean;
          cancelled_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          sale_date?: string;
          amount?: number;
          currency?: Database["public"]["Enums"]["currency_code"];
          exchange_rate?: number;
          amount_usd?: number;
          amount_uyu?: number;
          listing_price_usd_at_sale?: number | null;
          customer_id?: string | null;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          amount_paid?: number;
          due_date?: string | null;
          notes?: string | null;
          is_cancelled?: boolean;
          cancelled_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_catalogue_products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          brand: string;
          model: string;
          reference_number: string | null;
          year_approx: number | null;
          movement: Database["public"]["Enums"]["movement_type"];
          case_material: string | null;
          strap_material: string | null;
          diameter_mm: number | null;
          water_resistance: string | null;
          gender: string | null;
          condition: string;
          includes_box: boolean;
          includes_documentation: boolean;
          includes_accessories: string | null;
          public_description: string;
          status: Database["public"]["Enums"]["product_status"];
          is_featured: boolean;
          price_usd: number;
          published_at: string | null;
          listing_updated_at: string | null;
          updated_at: string;
          cover_image_path: string | null;
          cover_image_alt: string | null;
          images: Json;
        };
        Relationships: [];
      };
      public_settings: {
        Row: {
          key: string;
          value: Json;
        };
        Relationships: [];
      };
    };
    Functions: {
      assert_admin: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      cancel_sale: {
        Args: { p_sale_id: string; p_reason: string };
        Returns: undefined;
      };
      change_product_status: {
        Args: {
          p_product_id: string;
          p_new_status: Database["public"]["Enums"]["product_status"];
          p_note?: string | null;
        };
        Returns: undefined;
      };
      create_cash_transfer: {
        Args: {
          p_from_account: string;
          p_to_account: string;
          p_date: string;
          p_amount_from: number;
          p_amount_to: number;
          p_exchange_rate: number;
          p_description?: string;
        };
        Returns: string;
      };
      get_active_usd_uyu_rate: {
        Args: Record<PropertyKey, never>;
        Returns: {
          rate: number;
          rate_date: string;
          source: string;
          is_manual: boolean;
        }[];
      };
      get_catalogue_rate: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      is_active_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      log_audit: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id: string | null;
          p_old?: Json | null;
          p_new?: Json | null;
        };
        Returns: undefined;
      };
      mark_product_sold: {
        Args: {
          p_product_id: string;
          p_sale_date: string;
          p_amount: number;
          p_currency: Database["public"]["Enums"]["currency_code"];
          p_exchange_rate: number;
          p_customer_id?: string | null;
          p_payment_method?: string | null;
          p_amount_received?: number;
          p_cash_account_id?: string | null;
          p_due_date?: string | null;
          p_notes?: string | null;
          p_expenses?: Json;
          p_allow_date_before_purchase?: boolean;
        };
        Returns: string;
      };
      register_payment: {
        Args: {
          p_transaction_type: Database["public"]["Enums"]["payment_transaction_type"];
          p_transaction_id: string;
          p_payment_date: string;
          p_amount: number;
          p_currency: Database["public"]["Enums"]["currency_code"];
          p_exchange_rate: number;
          p_payment_method?: string | null;
          p_cash_account_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      set_listing_price: {
        Args: {
          p_product_id: string;
          p_amount: number;
          p_currency: Database["public"]["Enums"]["currency_code"];
          p_exchange_rate: number;
          p_rate_date?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      cash_transaction_type:
        | "cobro_venta"
        | "otro_ingreso"
        | "aporte_dueno"
        | "pago_compra"
        | "pago_costo_producto"
        | "pago_gasto_general"
        | "pago_gasto_venta"
        | "retiro_dueno"
        | "otro_egreso"
        | "transferencia_entrada"
        | "transferencia_salida"
        | "ajuste_positivo"
        | "ajuste_negativo";
      currency_code: "USD" | "UYU";
      expense_category_kind: "costo_producto" | "gasto_general" | "gasto_venta";
      movement_type: "automatico" | "manual" | "cuarzo" | "solar" | "otro";
      payment_status: "pagado" | "parcial" | "pendiente" | "cancelado";
      payment_transaction_type:
        | "venta"
        | "compra"
        | "costo_producto"
        | "gasto_general"
        | "gasto_venta";
      product_status:
        | "disponible"
        | "reservado"
        | "vendido"
        | "en_reparacion"
        | "no_publicado"
        | "archivado";
      user_role: "admin" | "viewer";
    };
    CompositeTypes: Record<string, never>;
  };
};

// ------------------------------------------------------------
// Alias de conveniencia
// ------------------------------------------------------------
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type CurrencyCode = Enums<"currency_code">;
export type ProductStatus = Enums<"product_status">;
export type MovementType = Enums<"movement_type">;
export type PaymentStatus = Enums<"payment_status">;
export type UserRole = Enums<"user_role">;
export type CatalogueProduct = Views<"public_catalogue_products">;
