import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ttsmyustlrzvaxdiadml.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0c215dXN0bHJ6dmF4ZGlhZG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDQ0MDQsImV4cCI6MjEwNDcyMDQwNH0.ckYILCG9jzdrw7lvMUlUhtAnqsMSKd-lm8zJCnJGrZ0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface CloudOrder {
  id: string;
  org_id: string;
  customer: string;
  phone: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  items: any[];
  notes?: string;
  needs_clarification?: boolean;
  source?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  updated_by?: string;
}

export interface CloudMember {
  id: string;
  org_id: string;
  member_name: string;
  email?: string;
  role: 'owner' | 'manager' | 'operator';
  avatar_initials: string;
  created_at?: string;
}

export interface CloudOrganization {
  id: string;
  name: string;
  slug: string;
  capacity: number;
  currency: string;
}
