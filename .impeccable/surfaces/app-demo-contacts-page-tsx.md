# Contacts preview

## Scope and visitor mode
Public, anonymous `/demo/contacts` directory and `/demo/contacts/[contactId]` detail. Mode: Operate.

## Audience and task
A visitor exploring Nexa CRM’s read-only sample workspace can locate a fictional contact, inspect the exact supplied facts, and return to the directory. Search, contact links, and a directory back link are the only actions.

## Proof and constraints
Use only `createDemoRecords()` and its existing fictional contacts, companies, deals, and tasks. Search name, company, job title, and email. Relate deals by exact contact name and company facts/tasks by exact company name; label tasks company-related. Keep every fact clearly fictional/read-only, invent no relationship or lifecycle data, and retain the current demo shell and its mobile behavior.

## Direction contract
THESIS: Make the fixture’s 27 contacts browsable and inspectable without implying a live CRM; refuse invented profile timelines or ownership.

OWN-WORLD: Inherit the demo shell, neutral surfaces, restrained primary accent, compact tables, visible focus treatment, and sample-data notice. Add no independent palette or ornamental profile chrome.

STORY: Visitors scan the directory, search by the four supported fields, open a contact, distinguish direct contact facts from exact-name deal associations and company-related facts/tasks, then return to the directory.

FIRST VIEWPORT: Keep the shared notice above a clear Contacts heading and sample label. Put one full-width labeled search field and live result count above a semantic table. On detail, lead with a directory back link, contact name, and explicit fictional/read-only label, followed by contact facts and only fixture-backed related sections.

FORM: Ranked first: extend the established demo directory/detail grammar; this is a precise extension, so no concept tournament. Seed key: `inherit-demo-record-directory`.

FINISH: Review the completed directory and detail against the inherited demo style; confirm displayed values and relationships remain fixture-backed and the preview stays fictional and read-only.
