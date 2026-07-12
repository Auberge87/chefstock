-- The initial schema tracked "delivered" as a boolean, but delivery reconciliation
-- needs the actual delivered quantity (to compare against qty ordered and flag
-- under/over-deliveries), matching the legacy prototype's behavior.

alter table order_items drop column if exists delivered;
alter table order_items add column if not exists delivered_qty numeric(10,2);
