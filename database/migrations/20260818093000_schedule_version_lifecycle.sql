-- Normalize legacy schedule versions so each academic context has exactly one
-- active committed version. Older committed versions remain available as
-- superseded history. This is data-only; no schedule rows are deleted.
with ranked as (
  select
    id,
    row_number() over (
      partition by academic_context_id
      order by created_at desc, id desc
    ) as rn
  from public.schedule_version
  where status = 'active'
)
update public.schedule_version sv
set status = 'superseded'
from ranked r
where sv.id = r.id
  and r.rn > 1;
