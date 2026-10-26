-- Fee fairness: remember how far the driver was from the pickup when they accepted,
-- so a cancellation fee can be waived when they never headed toward the rider.
alter table trips add column accept_distance_m integer;
-- Driver account reviews: a suspension or rejection must say why.
alter table support_tickets drop constraint support_tickets_category_check;
alter table support_tickets add constraint support_tickets_category_check
  check (category in ('fare','cancellation_fee','route','lost_item','safety','driver','account_review','other'));
