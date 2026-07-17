-- Seed Georgia / metro Atlanta DPA programs (shared: agent_id null).
-- Verify amounts before using in live intakes.

insert into dpa_programs (id, agent_id, name, amount, type, county, notes, active) values
  ('a1000000-0000-4000-8000-000000000001', null, 'Georgia Dream', 10000, 'forgivable', null, 'Statewide first-time buyer assistance (confirm current amount & eligibility)', true),
  ('a1000000-0000-4000-8000-000000000002', null, 'Atlanta Housing Opportunity Bond / City DPA', 20000, 'forgivable', 'Fulton', 'City of Atlanta programs — amount varies by income band', true),
  ('a1000000-0000-4000-8000-000000000003', null, 'DeKalb County Homebuyer Assistance', 10000, 'forgivable', 'DeKalb', 'Confirm current DeKalb allocation and income limits', true),
  ('a1000000-0000-4000-8000-000000000004', null, 'Gwinnett County Homebuyer Program', 10000, 'forgivable', 'Gwinnett', 'Confirm current Gwinnett terms', true),
  ('a1000000-0000-4000-8000-000000000005', null, 'Cobb County Down Payment Assistance', 10000, 'forgivable', 'Cobb', 'Confirm current Cobb terms', true),
  ('a1000000-0000-4000-8000-000000000006', null, 'FHLB Atlanta Affordable Housing Program', 15000, 'grant', null, 'Via participating lenders — amount and availability vary', true),
  ('a1000000-0000-4000-8000-000000000007', null, 'Employer / Nonprofit Gift Funds', 5000, 'grant', null, 'Placeholder for gift letters and community partners', true)
on conflict (id) do nothing;
