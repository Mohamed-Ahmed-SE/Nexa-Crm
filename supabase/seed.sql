-- Local/test demo data only. Run through `supabase db reset` on a disposable local stack.
-- Fixed IDs and conflict-safe writes make the dataset repeatable.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'avery.stone@northstar-demo.example', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Avery Stone"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya.hassan@northstar-demo.example', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maya Hassan"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'omar.nabil@northstar-demo.example', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Omar Nabil"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lina.kareem@northstar-demo.example', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lina Kareem"}', now(), now(), false, false),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam.reed@northstar-demo.example', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Reed"}', now(), now(), false, false)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at,
  is_sso_user = excluded.is_sso_user,
  is_anonymous = excluded.is_anonymous;

insert into public.profiles (id, full_name, job_title, timezone)
values
  ('00000000-0000-4000-8000-000000000101', 'Avery Stone', 'Founder / Admin', 'UTC'),
  ('00000000-0000-4000-8000-000000000102', 'Maya Hassan', 'Sales Manager', 'UTC'),
  ('00000000-0000-4000-8000-000000000103', 'Omar Nabil', 'Account Executive', 'UTC'),
  ('00000000-0000-4000-8000-000000000104', 'Lina Kareem', 'Sales Representative', 'UTC'),
  ('00000000-0000-4000-8000-000000000105', 'Sam Reed', 'Operations', 'UTC')
on conflict (id) do update set
  full_name = excluded.full_name,
  job_title = excluded.job_title,
  timezone = excluded.timezone,
  updated_at = now();

insert into public.workspaces (id, name, slug, default_currency, timezone)
values ('00000000-0000-4000-8000-000000000001', 'Northstar Digital', 'northstar-digital-demo-local', 'USD', 'UTC')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  default_currency = excluded.default_currency,
  timezone = excluded.timezone,
  updated_at = now();

insert into public.workspace_members (workspace_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'admin', 'active'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'manager', 'active'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'member', 'active'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', 'member', 'active'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'viewer', 'active')
on conflict (workspace_id, user_id) do update set
  role = excluded.role,
  status = excluded.status;

insert into public.companies (
  id, workspace_id, name, website, industry, employee_size, phone, city, country,
  description, owner_id, created_by
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Vertex Logistics', 'https://vertex-logistics.example', 'Logistics', 420, '+1-555-0101', 'Austin', 'United States', 'Regional logistics platform modernizing freight operations.', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Luna Commerce', 'https://luna-commerce.example', 'Ecommerce', 85, '+1-555-0102', 'Portland', 'United States', 'Direct-to-consumer commerce brand expanding its digital storefront.', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Atlas Property Group', 'https://atlas-property.example', 'Real Estate', 210, '+1-555-0103', 'Denver', 'United States', 'Property group evaluating a tenant and portfolio experience.', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Clinica One', 'https://clinica-one.example', 'Healthcare', 160, '+1-555-0104', 'Chicago', 'United States', 'Outpatient care network improving patient scheduling.', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'BrightPath Learning', 'https://brightpath-learning.example', 'Education', 95, '+1-555-0105', 'Boston', 'United States', 'Learning platform building a new institutional product.', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'Harbor Hotels', 'https://harbor-hotels.example', 'Hospitality', 310, '+1-555-0106', 'Miami', 'United States', 'Independent hotel group consolidating guest services.', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'ForgeWorks Manufacturing', 'https://forgeworks.example', 'Manufacturing', 540, '+1-555-0107', 'Cleveland', 'United States', 'Manufacturer planning customer portal and quoting improvements.', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'NovaStack', 'https://novastack.example', 'SaaS', 72, '+1-555-0108', 'Seattle', 'United States', 'Software company seeking a product onboarding redesign.', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'Greenline Foods', 'https://greenline-foods.example', 'Ecommerce', 130, '+1-555-0109', 'Atlanta', 'United States', 'Food business growing online wholesale and retail channels.', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'Cedar Consulting', 'https://cedar-consulting.example', 'SaaS', 44, '+1-555-0110', 'Raleigh', 'United States', 'Consultancy launching a client-facing delivery workspace.', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Meridian Health', 'https://meridian-health.example', 'Healthcare', 230, '+1-555-0111', 'Phoenix', 'United States', 'Healthcare provider assessing digital intake workflows.', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'Orchard Software', 'https://orchard-software.example', 'SaaS', 118, '+1-555-0112', 'New York', 'United States', 'B2B software team planning analytics and customer portal work.', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101')
on conflict (id) do update set
  name = excluded.name, website = excluded.website, industry = excluded.industry,
  employee_size = excluded.employee_size, phone = excluded.phone, city = excluded.city,
  country = excluded.country, description = excluded.description,
  owner_id = excluded.owner_id, updated_at = now();

insert into public.contacts (
  id, workspace_id, company_id, first_name, last_name, email, phone, job_title,
  owner_id, lifecycle_status, created_by
)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Elena', 'Park', 'elena.park@vertex-logistics.example', '+1-555-0201', 'VP of Operations', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Marcus', 'Lee', 'marcus.lee@vertex-logistics.example', '+1-555-0202', 'Product Director', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Sofia', 'Bennett', 'sofia.bennett@luna-commerce.example', '+1-555-0203', 'Head of Digital', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Noah', 'Turner', 'noah.turner@luna-commerce.example', '+1-555-0204', 'Ecommerce Manager', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Priya', 'Shah', 'priya.shah@atlas-property.example', '+1-555-0205', 'Chief Operating Officer', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Ethan', 'Brooks', 'ethan.brooks@atlas-property.example', '+1-555-0206', 'Director of Leasing', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'Amira', 'Haddad', 'amira.haddad@clinica-one.example', '+1-555-0207', 'Chief Experience Officer', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'Lucas', 'Reed', 'lucas.reed@clinica-one.example', '+1-555-0208', 'IT Program Lead', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Grace', 'Kim', 'grace.kim@brightpath-learning.example', '+1-555-0209', 'VP of Product', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Daniel', 'Price', 'daniel.price@brightpath-learning.example', '+1-555-0210', 'Academic Partnerships Lead', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'Isabel', 'Morgan', 'isabel.morgan@harbor-hotels.example', '+1-555-0211', 'Chief Marketing Officer', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'Oliver', 'Chen', 'oliver.chen@harbor-hotels.example', '+1-555-0212', 'Guest Services Director', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'Nadia', 'Cole', 'nadia.cole@forgeworks.example', '+1-555-0213', 'VP of Customer Programs', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'Henry', 'Adams', 'henry.adams@forgeworks.example', '+1-555-0214', 'Sales Operations Manager', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'Zara', 'Malik', 'zara.malik@novastack.example', '+1-555-0215', 'Chief Product Officer', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000008', 'Caleb', 'Foster', 'caleb.foster@novastack.example', '+1-555-0216', 'Customer Success Lead', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Mia', 'Sullivan', 'mia.sullivan@greenline-foods.example', '+1-555-0217', 'VP of Ecommerce', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Owen', 'Diaz', 'owen.diaz@greenline-foods.example', '+1-555-0218', 'Wholesale Director', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000019', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'Ava', 'Wilson', 'ava.wilson@cedar-consulting.example', '+1-555-0219', 'Managing Partner', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'Leo', 'Martin', 'leo.martin@cedar-consulting.example', '+1-555-0220', 'Client Services Lead', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'Hana', 'Youssef', 'hana.youssef@meridian-health.example', '+1-555-0221', 'Director of Patient Experience', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000011', 'Jack', 'Evans', 'jack.evans@meridian-health.example', '+1-555-0222', 'Technology Director', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000023', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012', 'Layla', 'Fischer', 'layla.fischer@orchard-software.example', '+1-555-0223', 'Chief Revenue Officer', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000012', 'Theo', 'Baker', 'theo.baker@orchard-software.example', '+1-555-0224', 'Director of Analytics', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000025', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Renee', 'Wong', 'renee.wong@vertex-logistics.example', '+1-555-0225', 'Finance Director', '00000000-0000-4000-8000-000000000103', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000026', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Jamal', 'Carter', 'jamal.carter@luna-commerce.example', '+1-555-0226', 'Growth Marketing Lead', '00000000-0000-4000-8000-000000000104', 'active', '00000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000027', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Maya', 'Patel', 'maya.patel@atlas-property.example', '+1-555-0227', 'Portfolio Manager', '00000000-0000-4000-8000-000000000102', 'active', '00000000-0000-4000-8000-000000000101')
on conflict (id) do update set
  company_id = excluded.company_id, first_name = excluded.first_name,
  last_name = excluded.last_name, email = excluded.email, phone = excluded.phone,
  job_title = excluded.job_title, owner_id = excluded.owner_id,
  lifecycle_status = excluded.lifecycle_status, updated_at = now();

with seed_leads (id, full_name, company_name, email, job_title, source_name, status, owner_id, estimated_value) as (
  values
    ('30000000-0000-4000-8000-000000000001'::uuid, 'Aiden Brooks', 'Summit Freight', 'aiden.brooks@summit-freight.example', 'Operations Lead', 'Website', 'new', '00000000-0000-4000-8000-000000000103'::uuid, 42000::numeric),
    ('30000000-0000-4000-8000-000000000002', 'Mila Torres', 'Juniper Retail', 'mila.torres@juniper-retail.example', 'Founder', 'Referral', 'new', '00000000-0000-4000-8000-000000000104', 28000),
    ('30000000-0000-4000-8000-000000000003', 'Eli Navarro', 'Beacon Health', 'eli.navarro@beacon-health.example', 'Product Manager', 'LinkedIn', 'new', '00000000-0000-4000-8000-000000000103', 36000),
    ('30000000-0000-4000-8000-000000000004', 'Sana Ibrahim', 'Cloudberry Labs', 'sana.ibrahim@cloudberry-labs.example', 'COO', 'Outbound', 'new', '00000000-0000-4000-8000-000000000104', 54000),
    ('30000000-0000-4000-8000-000000000005', 'Finn Murphy', 'Oakline Estates', 'finn.murphy@oakline-estates.example', 'Digital Director', 'Event', 'new', '00000000-0000-4000-8000-000000000103', 31000),
    ('30000000-0000-4000-8000-000000000006', 'Nora Ali', 'Willow Medical', 'nora.ali@willow-medical.example', 'Practice Manager', 'Website', 'new', '00000000-0000-4000-8000-000000000104', 47000),
    ('30000000-0000-4000-8000-000000000007', 'Theo Grant', 'Riverstone Apps', 'theo.grant@riverstone-apps.example', 'CEO', 'Referral', 'new', '00000000-0000-4000-8000-000000000103', 62000),
    ('30000000-0000-4000-8000-000000000008', 'Zoe Chen', 'Pioneer Supply', 'zoe.chen@pioneer-supply.example', 'VP Sales', 'LinkedIn', 'contacted', '00000000-0000-4000-8000-000000000104', 39000),
    ('30000000-0000-4000-8000-000000000009', 'Omar Farouk', 'Silverline Travel', 'omar.farouk@silverline-travel.example', 'Commercial Lead', 'Outbound', 'contacted', '00000000-0000-4000-8000-000000000103', 33000),
    ('30000000-0000-4000-8000-000000000010', 'Ruby Ellis', 'Cobalt Learning', 'ruby.ellis@cobalt-learning.example', 'Founder', 'Event', 'contacted', '00000000-0000-4000-8000-000000000104', 26000),
    ('30000000-0000-4000-8000-000000000011', 'Idris Khan', 'Pinecone Commerce', 'idris.khan@pinecone-commerce.example', 'Digital Lead', 'Website', 'contacted', '00000000-0000-4000-8000-000000000103', 44000),
    ('30000000-0000-4000-8000-000000000012', 'Ella James', 'MetroCare Group', 'ella.james@metrocare.example', 'Operations Director', 'Referral', 'contacted', '00000000-0000-4000-8000-000000000104', 58000),
    ('30000000-0000-4000-8000-000000000013', 'Rafi Ahmed', 'Northwind Systems', 'rafi.ahmed@northwind-systems.example', 'Head of Product', 'LinkedIn', 'qualified', '00000000-0000-4000-8000-000000000103', 75000),
    ('30000000-0000-4000-8000-000000000014', 'Chloe Martin', 'Maple Street Hotels', 'chloe.martin@maple-hotels.example', 'Managing Director', 'Outbound', 'qualified', '00000000-0000-4000-8000-000000000104', 64000),
    ('30000000-0000-4000-8000-000000000015', 'Yusuf Saleh', 'Evergreen Foods', 'yusuf.saleh@evergreen-foods.example', 'VP Ecommerce', 'Event', 'qualified', '00000000-0000-4000-8000-000000000103', 52000),
    ('30000000-0000-4000-8000-000000000016', 'Freya Scott', 'Redwood Robotics', 'freya.scott@redwood-robotics.example', 'General Manager', 'Website', 'qualified', '00000000-0000-4000-8000-000000000104', 81000),
    ('30000000-0000-4000-8000-000000000017', 'Samir Bose', 'Clearwater Property', 'samir.bose@clearwater-property.example', 'Portfolio Director', 'Referral', 'qualified', '00000000-0000-4000-8000-000000000103', 68000),
    ('30000000-0000-4000-8000-000000000018', 'Ada Williams', 'Bluebird Media', 'ada.williams@bluebird-media.example', 'Marketing Manager', 'LinkedIn', 'unqualified', '00000000-0000-4000-8000-000000000104', 19000),
    ('30000000-0000-4000-8000-000000000019', 'Kareem Hassan', 'Westlake Clinics', 'kareem.hassan@westlake-clinics.example', 'Practice Owner', 'Outbound', 'unqualified', '00000000-0000-4000-8000-000000000103', 22000),
    ('30000000-0000-4000-8000-000000000020', 'Ivy Cooper', 'Daybreak Education', 'ivy.cooper@daybreak-education.example', 'Program Director', 'Event', 'unqualified', '00000000-0000-4000-8000-000000000104', 17000)
)
insert into public.leads (
  id, workspace_id, full_name, company_name, email, job_title, source_id, status,
  owner_id, estimated_value, currency, notes_summary, created_by
)
select l.id, '00000000-0000-4000-8000-000000000001', l.full_name, l.company_name,
  l.email, l.job_title, s.id, l.status, l.owner_id, l.estimated_value, 'USD',
  'Demo prospect record for local workflow testing.', '00000000-0000-4000-8000-000000000101'
from seed_leads l
join public.lead_sources s on s.workspace_id = '00000000-0000-4000-8000-000000000001' and s.name = l.source_name
on conflict (id) do update set
  full_name = excluded.full_name, company_name = excluded.company_name,
  email = excluded.email, job_title = excluded.job_title, source_id = excluded.source_id,
  status = excluded.status, owner_id = excluded.owner_id,
  estimated_value = excluded.estimated_value, currency = excluded.currency,
  notes_summary = excluded.notes_summary, updated_at = now();

insert into public.saved_views (
  id, workspace_id, user_id, entity_type, name, filters, sort, visible_columns
)
values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'leads', 'New leads', '{"q":"","status":"new","sourceId":"","ownerId":""}'::jsonb, '"updated_desc"'::jsonb, '["name","company","status","source","owner","updated"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'leads', 'Qualified leads', '{"q":"","status":"qualified","sourceId":"","ownerId":""}'::jsonb, '"name_asc"'::jsonb, '["name","company","status","source","owner","value"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'leads', 'New leads', '{"q":"","status":"new","sourceId":"","ownerId":""}'::jsonb, '"updated_desc"'::jsonb, '["name","company","status","source","owner","updated"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'leads', 'Qualified leads', '{"q":"","status":"qualified","sourceId":"","ownerId":""}'::jsonb, '"name_asc"'::jsonb, '["name","company","status","source","owner","value"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'leads', 'New leads', '{"q":"","status":"new","sourceId":"","ownerId":""}'::jsonb, '"updated_desc"'::jsonb, '["name","company","status","source","owner","updated"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'leads', 'Qualified leads', '{"q":"","status":"qualified","sourceId":"","ownerId":""}'::jsonb, '"name_asc"'::jsonb, '["name","company","status","source","owner","value"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', 'leads', 'New leads', '{"q":"","status":"new","sourceId":"","ownerId":""}'::jsonb, '"updated_desc"'::jsonb, '["name","company","status","source","owner","updated"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', 'leads', 'Qualified leads', '{"q":"","status":"qualified","sourceId":"","ownerId":""}'::jsonb, '"name_asc"'::jsonb, '["name","company","status","source","owner","value"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'leads', 'New leads', '{"q":"","status":"new","sourceId":"","ownerId":""}'::jsonb, '"updated_desc"'::jsonb, '["name","company","status","source","owner","updated"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'leads', 'Qualified leads', '{"q":"","status":"qualified","sourceId":"","ownerId":""}'::jsonb, '"name_asc"'::jsonb, '["name","company","status","source","owner","value"]'::jsonb)
on conflict (workspace_id, user_id, entity_type, name) do update set
  filters = excluded.filters,
  sort = excluded.sort,
  visible_columns = excluded.visible_columns,
  updated_at = now();

with seed_deals (id, title, company_id, contact_id, stage_name, amount, owner_id, source_name, priority, expected_close_date, status, won_at, lost_at, lost_reason) as (
  values
    ('40000000-0000-4000-8000-000000000001'::uuid, 'Vertex freight visibility platform', '10000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'Proposal', 148000::numeric, '00000000-0000-4000-8000-000000000103'::uuid, 'Referral', 'high', current_date - 12, 'open', null::timestamptz, null::timestamptz, null::text),
    ('40000000-0000-4000-8000-000000000002', 'Luna digital storefront expansion', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'Negotiation', 126000, '00000000-0000-4000-8000-000000000104', 'Website', 'high', current_date + 8, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000003', 'Atlas tenant portal program', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', 'Qualified', 112000, '00000000-0000-4000-8000-000000000102', 'Event', 'high', current_date + 15, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000004', 'Clinica One patient scheduling', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000007', 'Discovery', 76000, '00000000-0000-4000-8000-000000000103', 'LinkedIn', 'medium', current_date - 5, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000005', 'BrightPath institutional onboarding', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000009', 'Discovery', 54000, '00000000-0000-4000-8000-000000000104', 'Website', 'medium', current_date + 22, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000006', 'Harbor guest services redesign', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000011', 'Discovery', 69000, '00000000-0000-4000-8000-000000000102', 'Referral', 'medium', current_date + 30, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000007', 'ForgeWorks customer portal', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000013', 'Discovery', 98000, '00000000-0000-4000-8000-000000000103', 'Outbound', 'high', current_date + 35, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000008', 'NovaStack activation redesign', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000015', 'Qualified', 87000, '00000000-0000-4000-8000-000000000104', 'LinkedIn', 'high', current_date + 12, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000009', 'Greenline wholesale channel', '10000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000017', 'Qualified', 63000, '00000000-0000-4000-8000-000000000102', 'Event', 'medium', current_date + 28, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000010', 'Cedar client delivery workspace', '10000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000019', 'Qualified', 47000, '00000000-0000-4000-8000-000000000103', 'Referral', 'medium', current_date + 42, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000011', 'Meridian digital intake', '10000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000021', 'Proposal', 92000, '00000000-0000-4000-8000-000000000104', 'Website', 'high', current_date + 18, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000012', 'Orchard analytics portal', '10000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000023', 'Proposal', 88000, '00000000-0000-4000-8000-000000000102', 'LinkedIn', 'high', current_date + 24, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000013', 'Vertex finance operations', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000025', 'Proposal', 58000, '00000000-0000-4000-8000-000000000103', 'Outbound', 'medium', current_date + 31, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000014', 'Luna growth marketing program', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000026', 'Negotiation', 74000, '00000000-0000-4000-8000-000000000104', 'Event', 'medium', current_date + 10, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000015', 'Atlas portfolio insights', '10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000027', 'Negotiation', 83000, '00000000-0000-4000-8000-000000000102', 'Referral', 'high', current_date + 20, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000016', 'Clinica One experience research', '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000008', 'Negotiation', 44000, '00000000-0000-4000-8000-000000000103', 'Outbound', 'medium', current_date + 38, 'open', null, null, null),
    ('40000000-0000-4000-8000-000000000017', 'BrightPath learning product strategy', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000010', 'Won', 68000, '00000000-0000-4000-8000-000000000104', 'Website', 'high', current_date - 18, 'won', now() - interval '18 days', null, null),
    ('40000000-0000-4000-8000-000000000018', 'Harbor loyalty experience', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000012', 'Won', 94000, '00000000-0000-4000-8000-000000000102', 'Referral', 'high', current_date - 47, 'won', now() - interval '47 days', null, null),
    ('40000000-0000-4000-8000-000000000019', 'ForgeWorks quoting discovery', '10000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000014', 'Won', 42000, '00000000-0000-4000-8000-000000000103', 'Outbound', 'medium', current_date - 76, 'won', now() - interval '76 days', null, null),
    ('40000000-0000-4000-8000-000000000020', 'NovaStack customer analytics', '10000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000016', 'Won', 96000, '00000000-0000-4000-8000-000000000104', 'LinkedIn', 'high', current_date - 108, 'won', now() - interval '108 days', null, null),
    ('40000000-0000-4000-8000-000000000021', 'Greenline loyalty pilot', '10000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000018', 'Lost', 39000, '00000000-0000-4000-8000-000000000102', 'Event', 'medium', current_date - 35, 'lost', null, now() - interval '35 days', 'Price'),
    ('40000000-0000-4000-8000-000000000022', 'Cedar reporting engagement', '10000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000020', 'Lost', 51000, '00000000-0000-4000-8000-000000000103', 'Referral', 'medium', current_date - 63, 'lost', null, now() - interval '63 days', 'Timing'),
    ('40000000-0000-4000-8000-000000000023', 'Meridian booking optimization', '10000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000022', 'Lost', 73000, '00000000-0000-4000-8000-000000000104', 'Website', 'high', current_date - 91, 'lost', null, now() - interval '91 days', 'Competitor')
)
insert into public.deals (
  id, workspace_id, pipeline_id, stage_id, title, company_id, primary_contact_id,
  amount, currency, probability, expected_close_date, owner_id, source_id, priority,
  description, status, won_at, lost_at, lost_reason_id, lost_reason_text, created_by
)
select d.id, '00000000-0000-4000-8000-000000000001', p.id, ps.id, d.title,
  d.company_id, d.contact_id, d.amount, 'USD', ps.probability, d.expected_close_date,
  d.owner_id, ls.id, d.priority, 'Demo opportunity for local pipeline and report testing.',
  d.status, d.won_at, d.lost_at, lr.id, case when d.status = 'lost' then d.lost_reason else null end,
  '00000000-0000-4000-8000-000000000101'
from seed_deals d
join public.pipelines p on p.workspace_id = '00000000-0000-4000-8000-000000000001' and p.is_default
join public.pipeline_stages ps on ps.workspace_id = p.workspace_id and ps.pipeline_id = p.id and ps.name = d.stage_name
join public.lead_sources ls on ls.workspace_id = p.workspace_id and ls.name = d.source_name
left join public.lost_reasons lr on lr.workspace_id = p.workspace_id and lr.name = d.lost_reason
on conflict (id) do update set
  pipeline_id = excluded.pipeline_id, stage_id = excluded.stage_id,
  title = excluded.title, company_id = excluded.company_id,
  primary_contact_id = excluded.primary_contact_id, amount = excluded.amount,
  currency = excluded.currency, probability = excluded.probability,
  expected_close_date = excluded.expected_close_date, owner_id = excluded.owner_id,
  source_id = excluded.source_id, priority = excluded.priority,
  description = excluded.description, status = excluded.status,
  won_at = excluded.won_at, lost_at = excluded.lost_at,
  lost_reason_id = excluded.lost_reason_id, lost_reason_text = excluded.lost_reason_text,
  updated_at = now();

with seed_tasks (id, title, description, status, priority, due_at, assigned_to, entity_type, entity_id, completed_at) as (
  values
    ('50000000-0000-4000-8000-000000000001'::uuid, 'Share Vertex proposal revisions', 'Completed after proposal review.', 'completed', 'high', now() - interval '3 days', '00000000-0000-4000-8000-000000000103'::uuid, 'deal', '40000000-0000-4000-8000-000000000001'::uuid, now() - interval '2 days'),
    ('50000000-0000-4000-8000-000000000002', 'Send Luna commercial terms', 'Completed after commercial discussion.', 'completed', 'high', now() - interval '5 days', '00000000-0000-4000-8000-000000000104', 'deal', '40000000-0000-4000-8000-000000000002', now() - interval '4 days'),
    ('50000000-0000-4000-8000-000000000003', 'Confirm Atlas stakeholder list', 'Completed after discovery session.', 'completed', 'medium', now() - interval '6 days', '00000000-0000-4000-8000-000000000102', 'deal', '40000000-0000-4000-8000-000000000003', now() - interval '5 days'),
    ('50000000-0000-4000-8000-000000000004', 'Follow up on Clinica discovery', 'Overdue follow-up for the product discussion.', 'open', 'high', now() - interval '2 days', '00000000-0000-4000-8000-000000000103', 'deal', '40000000-0000-4000-8000-000000000004', null),
    ('50000000-0000-4000-8000-000000000005', 'Review BrightPath requirements', 'Overdue review before qualification.', 'open', 'medium', now() - interval '1 day', '00000000-0000-4000-8000-000000000104', 'deal', '40000000-0000-4000-8000-000000000005', null),
    ('50000000-0000-4000-8000-000000000006', 'Call Harbor operations team', 'Overdue outreach; no next task is set on selected deals.', 'open', 'high', now() - interval '4 days', '00000000-0000-4000-8000-000000000102', 'deal', '40000000-0000-4000-8000-000000000006', null),
    ('50000000-0000-4000-8000-000000000007', 'Confirm ForgeWorks workshop', 'Confirm agenda and attendees.', 'open', 'medium', now() - interval '3 days', '00000000-0000-4000-8000-000000000103', 'deal', '40000000-0000-4000-8000-000000000007', null),
    ('50000000-0000-4000-8000-000000000008', 'Check NovaStack feedback', 'Overdue feedback check.', 'open', 'high', now() - interval '1 day', '00000000-0000-4000-8000-000000000104', 'deal', '40000000-0000-4000-8000-000000000008', null),
    ('50000000-0000-4000-8000-000000000009', 'Prepare Vertex account brief', 'Due today.', 'open', 'medium', date_trunc('day', now()) + interval '10 hours', '00000000-0000-4000-8000-000000000103', 'company', '10000000-0000-4000-8000-000000000001', null),
    ('50000000-0000-4000-8000-000000000010', 'Send Luna design agenda', 'Due today.', 'open', 'high', date_trunc('day', now()) + interval '13 hours', '00000000-0000-4000-8000-000000000104', 'company', '10000000-0000-4000-8000-000000000002', null),
    ('50000000-0000-4000-8000-000000000011', 'Update Atlas opportunity notes', 'Due today.', 'open', 'low', date_trunc('day', now()) + interval '15 hours', '00000000-0000-4000-8000-000000000102', 'deal', '40000000-0000-4000-8000-000000000003', null),
    ('50000000-0000-4000-8000-000000000012', 'Review Clinica intake flow', 'Due today.', 'open', 'medium', date_trunc('day', now()) + interval '16 hours', '00000000-0000-4000-8000-000000000103', 'company', '10000000-0000-4000-8000-000000000004', null),
    ('50000000-0000-4000-8000-000000000013', 'Confirm BrightPath demo time', 'Due today.', 'open', 'medium', date_trunc('day', now()) + interval '18 hours', '00000000-0000-4000-8000-000000000104', 'company', '10000000-0000-4000-8000-000000000005', null),
    ('50000000-0000-4000-8000-000000000014', 'Send Harbor sample journey', 'Due tomorrow.', 'open', 'medium', date_trunc('day', now()) + interval '1 day 10 hours', '00000000-0000-4000-8000-000000000102', 'deal', '40000000-0000-4000-8000-000000000006', null),
    ('50000000-0000-4000-8000-000000000015', 'Collect ForgeWorks portal feedback', 'Due tomorrow.', 'open', 'high', date_trunc('day', now()) + interval '1 day 12 hours', '00000000-0000-4000-8000-000000000103', 'company', '10000000-0000-4000-8000-000000000007', null),
    ('50000000-0000-4000-8000-000000000016', 'Share NovaStack analytics outline', 'Due tomorrow.', 'open', 'medium', date_trunc('day', now()) + interval '1 day 14 hours', '00000000-0000-4000-8000-000000000104', 'deal', '40000000-0000-4000-8000-000000000008', null),
    ('50000000-0000-4000-8000-000000000017', 'Ask Greenline about channel mix', 'Due tomorrow.', 'open', 'low', date_trunc('day', now()) + interval '1 day 15 hours', '00000000-0000-4000-8000-000000000102', 'company', '10000000-0000-4000-8000-000000000009', null),
    ('50000000-0000-4000-8000-000000000018', 'Book Cedar stakeholder review', 'Due tomorrow.', 'open', 'medium', date_trunc('day', now()) + interval '1 day 16 hours', '00000000-0000-4000-8000-000000000103', 'company', '10000000-0000-4000-8000-000000000010', null),
    ('50000000-0000-4000-8000-000000000019', 'Prepare Meridian discovery brief', 'Due next week.', 'open', 'medium', date_trunc('day', now()) + interval '7 days 10 hours', '00000000-0000-4000-8000-000000000104', 'company', '10000000-0000-4000-8000-000000000011', null),
    ('50000000-0000-4000-8000-000000000020', 'Review Orchard analytics scope', 'Due next week.', 'open', 'high', date_trunc('day', now()) + interval '7 days 11 hours', '00000000-0000-4000-8000-000000000102', 'company', '10000000-0000-4000-8000-000000000012', null),
    ('50000000-0000-4000-8000-000000000021', 'Check in with Elena Park', 'Due next week.', 'open', 'low', date_trunc('day', now()) + interval '8 days 10 hours', '00000000-0000-4000-8000-000000000103', 'contact', '20000000-0000-4000-8000-000000000001', null),
    ('50000000-0000-4000-8000-000000000022', 'Schedule Luna commerce review', 'Due next week.', 'open', 'medium', date_trunc('day', now()) + interval '8 days 13 hours', '00000000-0000-4000-8000-000000000104', 'contact', '20000000-0000-4000-8000-000000000003', null),
    ('50000000-0000-4000-8000-000000000023', 'Draft Atlas portal outline', 'Due next week.', 'open', 'high', date_trunc('day', now()) + interval '9 days 10 hours', '00000000-0000-4000-8000-000000000102', 'contact', '20000000-0000-4000-8000-000000000005', null),
    ('50000000-0000-4000-8000-000000000024', 'Send Clinica recap', 'Completed follow-up.', 'completed', 'medium', now() - interval '12 days', '00000000-0000-4000-8000-000000000103', 'contact', '20000000-0000-4000-8000-000000000007', now() - interval '11 days'),
    ('50000000-0000-4000-8000-000000000025', 'Share BrightPath prototype', 'Completed prototype share.', 'completed', 'high', now() - interval '10 days', '00000000-0000-4000-8000-000000000104', 'contact', '20000000-0000-4000-8000-000000000009', now() - interval '9 days'),
    ('50000000-0000-4000-8000-000000000026', 'Record Harbor requirements', 'Completed requirements capture.', 'completed', 'low', now() - interval '8 days', '00000000-0000-4000-8000-000000000102', 'contact', '20000000-0000-4000-8000-000000000011', now() - interval '7 days'),
    ('50000000-0000-4000-8000-000000000027', 'Send ForgeWorks recap', 'Completed workshop recap.', 'completed', 'medium', now() - interval '6 days', '00000000-0000-4000-8000-000000000103', 'contact', '20000000-0000-4000-8000-000000000013', now() - interval '5 days'),
    ('50000000-0000-4000-8000-000000000028', 'Review NovaStack onboarding notes', 'Completed onboarding notes.', 'completed', 'medium', now() - interval '4 days', '00000000-0000-4000-8000-000000000104', 'contact', '20000000-0000-4000-8000-000000000015', now() - interval '3 days'),
    ('50000000-0000-4000-8000-000000000029', 'Update Greenline partner brief', 'Completed partner brief.', 'completed', 'low', now() - interval '3 days', '00000000-0000-4000-8000-000000000102', 'contact', '20000000-0000-4000-8000-000000000017', now() - interval '2 days'),
    ('50000000-0000-4000-8000-000000000030', 'Prepare Cedar delivery options', 'Completed options review.', 'completed', 'medium', now() - interval '2 days', '00000000-0000-4000-8000-000000000103', 'contact', '20000000-0000-4000-8000-000000000019', now() - interval '1 day')
)
insert into public.tasks (
  id, workspace_id, title, description, task_type, status, priority, due_at,
  assigned_to, created_by, related_entity_type, related_entity_id, completed_at
)
select t.id, '00000000-0000-4000-8000-000000000001', t.title, t.description,
  'to_do', t.status, t.priority, t.due_at, t.assigned_to,
  '00000000-0000-4000-8000-000000000101', t.entity_type, t.entity_id, t.completed_at
from seed_tasks t
on conflict (id) do update set
  title = excluded.title, description = excluded.description,
  task_type = excluded.task_type, status = excluded.status,
  priority = excluded.priority, due_at = excluded.due_at,
  assigned_to = excluded.assigned_to, related_entity_type = excluded.related_entity_type,
  related_entity_id = excluded.related_entity_id, completed_at = excluded.completed_at,
  updated_at = now();

insert into public.notes (id, workspace_id, body, is_pinned, created_by, related_entity_type, related_entity_id)
values
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Vertex is evaluating a phased launch. Operations and finance both need to approve the delivery timeline.', true, '00000000-0000-4000-8000-000000000101', 'deal', '40000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Luna agreed on the commercial outline and wants final delivery dates confirmed before signature.', true, '00000000-0000-4000-8000-000000000101', 'deal', '40000000-0000-4000-8000-000000000002'),
  ('60000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Atlas has several regional stakeholders; confirm property and leasing workflows in the next workshop.', false, '00000000-0000-4000-8000-000000000101', 'deal', '40000000-0000-4000-8000-000000000003')
on conflict (id) do update set
  body = excluded.body, is_pinned = excluded.is_pinned,
  related_entity_type = excluded.related_entity_type,
  related_entity_id = excluded.related_entity_id, updated_at = now();

with featured_deals (deal_id, contact_id, owner_id, task_id, stage_name, from_stage, meeting_subject, note_subject, change_subject) as (
  values
    ('40000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, '50000000-0000-4000-8000-000000000001'::uuid, 'Proposal', 'Discovery', 'Vertex proposal review', 'Vertex decision notes', 'Vertex moved to proposal'),
    ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000104', '50000000-0000-4000-8000-000000000002', 'Negotiation', 'Discovery', 'Luna commercial review', 'Luna commercial notes', 'Luna moved to negotiation'),
    ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000102', '50000000-0000-4000-8000-000000000003', 'Qualified', 'Discovery', 'Atlas stakeholder workshop', 'Atlas discovery notes', 'Atlas moved to qualified')
), activity_rows (id, deal_id, contact_id, owner_id, activity_type, subject, body, occurred_at, is_system_event, metadata) as (
  select md5(f.deal_id::text || ':' || e.event_kind)::uuid,
    f.deal_id, f.contact_id, f.owner_id,
    case e.event_kind when 'meeting' then 'meeting' when 'note' then 'note' when 'stage' then 'stage_changed' else 'task_completed' end,
    case e.event_kind when 'meeting' then f.meeting_subject when 'note' then f.note_subject when 'stage' then f.change_subject else 'Completed follow-up task' end,
    case e.event_kind when 'meeting' then 'Reviewed goals, stakeholders, next steps, and target timing.' when 'note' then 'Key account context captured for the deal team.' when 'stage' then 'Opportunity advanced after a customer milestone.' else 'The related follow-up was completed.' end,
    now() - case e.event_kind when 'meeting' then interval '2 days' when 'note' then interval '1 day 20 hours' when 'stage' then interval '1 day' else interval '12 hours' end,
    e.event_kind = 'stage',
    case when e.event_kind = 'stage' then jsonb_build_object('from_stage_id', previous_stage.id, 'to_stage_id', target_stage.id) else '{}'::jsonb end
  from featured_deals f
  cross join (values ('meeting'), ('note'), ('stage'), ('task')) e(event_kind)
  join public.pipeline_stages target_stage on target_stage.workspace_id = '00000000-0000-4000-8000-000000000001' and target_stage.name = f.stage_name
  join public.pipeline_stages previous_stage on previous_stage.workspace_id = target_stage.workspace_id and previous_stage.pipeline_id = target_stage.pipeline_id and previous_stage.name = f.from_stage
)
insert into public.activities (
  id, workspace_id, activity_type, subject, body, occurred_at, created_by,
  owner_id, related_entity_type, related_entity_id, metadata, is_system_event
)
select r.id, '00000000-0000-4000-8000-000000000001', r.activity_type, r.subject,
  r.body, r.occurred_at, '00000000-0000-4000-8000-000000000101', r.owner_id,
  'deal', r.deal_id, r.metadata, r.is_system_event
from activity_rows r
on conflict (id) do update set
  activity_type = excluded.activity_type, subject = excluded.subject,
  body = excluded.body, occurred_at = excluded.occurred_at,
  owner_id = excluded.owner_id, related_entity_type = excluded.related_entity_type,
  related_entity_id = excluded.related_entity_id, metadata = excluded.metadata,
  is_system_event = excluded.is_system_event, updated_at = now();

insert into public.tags (id, workspace_id, name, color_token)
values
  ('80000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Strategic', 'violet'),
  ('80000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Expansion', 'blue'),
  ('80000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Healthcare', 'green'),
  ('80000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Q2 Focus', 'amber'),
  ('80000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Referral', 'cyan'),
  ('80000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'At Risk', 'rose')
on conflict (id) do update set name = excluded.name, color_token = excluded.color_token;

insert into public.entity_tags (id, workspace_id, tag_id, entity_type, entity_id)
values
  ('81000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'deal', '40000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', 'deal', '40000000-0000-4000-8000-000000000002'),
  ('81000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'company', '10000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000003', 'company', '10000000-0000-4000-8000-000000000004'),
  ('81000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000004', 'lead', '30000000-0000-4000-8000-000000000013'),
  ('81000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000005', 'contact', '20000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000006', 'deal', '40000000-0000-4000-8000-000000000004')
on conflict (id) do update set
  tag_id = excluded.tag_id, entity_type = excluded.entity_type, entity_id = excluded.entity_id;

insert into public.crm_import_jobs (
  id, workspace_id, created_by, entity, status, total_rows, imported_rows, rejected_rows, row_errors, created_at
)
values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'companies', 'completed', 12, 12, 0, '[]'::jsonb, now() - interval '18 days'),
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'contacts', 'completed', 27, 27, 0, '[]'::jsonb, now() - interval '11 days'),
  ('90000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'leads', 'completed_with_errors', 22, 20, 2, '[{"row":4,"errors":["email: Missing email"]},{"row":17,"errors":["phone: Invalid phone placeholder"]}]'::jsonb, now() - interval '3 days')
on conflict (id) do update set
  entity = excluded.entity, status = excluded.status,
  total_rows = excluded.total_rows, imported_rows = excluded.imported_rows,
  rejected_rows = excluded.rejected_rows, row_errors = excluded.row_errors;

insert into public.notifications (
  id, workspace_id, recipient_id, notification_type, title, message,
  related_entity_type, related_entity_id, task_id, event_key, created_at, read_at
)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'task_overdue', 'Task overdue', 'Follow up on Clinica discovery', null, null, '50000000-0000-4000-8000-000000000004', 'demo:task-overdue:clinica', now() - interval '1 day', null),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', 'task_due', 'Task due today', 'Send Luna design agenda', null, null, '50000000-0000-4000-8000-000000000010', 'demo:task-due:luna', now() - interval '2 hours', null),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'deal_assigned', 'Deal assigned to you', 'Atlas tenant portal program', 'deal', '40000000-0000-4000-8000-000000000003', null, 'demo:deal-assigned:atlas', now() - interval '2 days', null),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'deal_won', 'Deal won', 'BrightPath institutional onboarding', 'deal', '40000000-0000-4000-8000-000000000017', null, 'demo:deal-won:brightpath', now() - interval '18 days', null),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'lead_assigned', 'Lead assigned to you', 'Aiden Brooks', 'lead', '30000000-0000-4000-8000-000000000001', null, 'demo:lead-assigned:aiden', now() - interval '4 days', now() - interval '1 day')
on conflict (workspace_id, recipient_id, notification_type, event_key) do update set
  title = excluded.title, message = excluded.message,
  related_entity_type = excluded.related_entity_type,
  related_entity_id = excluded.related_entity_id, task_id = excluded.task_id,
  created_at = excluded.created_at, read_at = excluded.read_at;

commit;
