-- Synchronise auth.users (géré par Supabase Auth) avec notre table public.users.
-- Dès qu'un compte est créé via Supabase Auth (inscription email/mdp, OAuth, admin API...),
-- une ligne correspondante est créée dans public.users avec le même id.
--
-- `security definer` : la fonction s'exécute avec les droits de son propriétaire (le rôle
-- ayant appliqué cette migration, superuser côté Supabase) et contourne donc le RLS activé
-- par défaut sur public.users, sans quoi l'insertion échouerait silencieusement.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
