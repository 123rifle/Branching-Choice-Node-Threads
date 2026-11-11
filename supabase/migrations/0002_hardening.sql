-- Column-level REVOKEs in 0001 don't override Supabase's table-level grants.
-- Replace with table-level revoke + explicit column grants.
revoke insert, update on profiles, posts, nodes, choices from authenticated, anon;

grant update (username, display_name, avatar_url, bio, links) on profiles to authenticated;
grant insert (creator_id, title, description, cover_url, topic, continuation) on posts to authenticated;
grant update (title, description, cover_url, topic, continuation) on posts to authenticated;
grant insert (post_id, parent_node_id, via_choice_id, chapter_number, prompt, media_url, duration_seconds) on nodes to authenticated;
grant update (prompt, media_url, duration_seconds) on nodes to authenticated;
grant insert (node_id, position, label, next_prompt) on choices to authenticated;
grant update (label, position, next_prompt) on choices to authenticated;

drop policy profiles_update_own on profiles;
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy posts_insert on posts;
create policy posts_insert on posts for insert with check (creator_id = auth.uid());

-- Owner-only lifecycle transitions
create function set_post_status(p_post_id uuid, p_status post_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('archived','draft') then raise exception 'not_allowed'; end if;
  update posts set status = p_status where id = p_post_id and creator_id = auth.uid() and status <> 'removed'
    and (p_status <> 'draft' or not exists (select 1 from nodes where post_id = p_post_id and status <> 'draft'));
  if not found then raise exception 'not_allowed'; end if;
end $$;

create function end_story(p_node_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_post uuid;
begin
  select p.id into v_post from nodes n join posts p on p.id = n.post_id
   where n.id = p_node_id and p.creator_id = auth.uid() and n.status = 'locked' for update of n;
  if not found then raise exception 'not_allowed'; end if;
  update nodes set is_final = true where id = p_node_id;
  update posts set status = 'completed' where id = v_post;
end $$;

-- Moderation (admin only)
create function admin_set_post_removed(p_post_id uuid, p_removed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_allowed'; end if;
  update posts set status = case when p_removed then 'removed'::post_status else 'archived'::post_status end where id = p_post_id;
end $$;
create function admin_set_suspended(p_user_id uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_allowed'; end if;
  update profiles set suspended = p_suspended where id = p_user_id;
end $$;
revoke execute on function lock_expired_nodes() from public, anon, authenticated;
