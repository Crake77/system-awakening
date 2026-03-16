import { supabase } from '../lib/supabase.js';

export async function cloudSave(state) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) { console.error('Cloud save failed:', error); return false; }
  return true;
}

export async function cloudLoad() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('saves')
    .select('data')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;
  return data.data;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
