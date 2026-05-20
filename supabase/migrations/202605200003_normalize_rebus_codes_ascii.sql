with normalized as (
  select
    id,
    left(regexp_replace(
      translate(upper(rebus_code), 'ÆØÅÄÖÜÉÈÊÁÀÂÓÒÔÍÌÎÚÙÛÑÇ', 'AOAAOUEEEAAAOOOIIIUUUNC'),
      '[^A-Z0-9]+',
      '-',
      'g'
    ), 24) as base_code
  from public.rebuses
),
numbered as (
  select
    id,
    trim(both '-' from base_code) as base_code,
    row_number() over (partition by trim(both '-' from base_code) order by id) as duplicate_number
  from normalized
)
update public.rebuses r
set rebus_code = case
  when numbered.duplicate_number = 1 then numbered.base_code
  else left(numbered.base_code, 20) || '-' || numbered.duplicate_number
end
from numbered
where numbered.id = r.id;
