# Support Staff Feature

This feature gives administrators a separate way to create and manage support-team
accounts. Support staff sign in through the main frontend, but use a dedicated
session and can only access the support workspace and support-ticket APIs.

The workspace includes:

- A controlled ticket queue: an agent must claim an unassigned ticket before
  replying or changing it, cannot take a ticket owned by another agent, and must
  record a handoff reason before returning it to the queue.
- A persistent general team room for announcements and incident coordination.
- Persistent direct messages between active support staff.
- Live online presence, unread message indicators, and ticket workload counts.
- An in-product guide explaining the recommended support workflow and safety rules.
- A persistent English/Persian language switch with full RTL layout in Persian.
- A mobile-first WhatsApp-style list-to-chat experience with back navigation,
  sticky conversation controls, safe-area message composer, and bottom navigation.
- Admin-managed staff specializations for general, contact, technical, payment,
  course, teacher, certificate, and team-lead support, shown in assignment workflows.
- An admin Team Chat inbox with the general room and direct staff conversations.
  Admins are not subscribed to customer-ticket live notifications.

## Entry points

- Admin account management: `/support-staff`
- Support staff login: `/support/login`
- Support staff workspace: `/support-team`

## Isolated feature folders

- Backend: `backend/src/modules/supportStaff/`
- Admin UI: `admin/src/features/supportStaff/`
- Support workspace: `frontend/src/features/supportStaff/`

## Required integration points

The isolated folders are connected to the existing application in these files:

- `backend/src/routes/index.js`
- `backend/src/routes/authRoutes.routes.js`
- `backend/src/models/User.js`
- `backend/src/models/SupportMessage.js`
- `backend/src/models/SupportTicket.js`
- `backend/src/controllers/supportController.js`
- `backend/src/services/supportRealtime.service.js`
- `admin/src/App.jsx`
- `admin/src/components/AdminSidebar.jsx`
- `admin/src/i18n/adminTranslations.js`
- `admin/src/pages/AdminSupportPage.jsx`
- `frontend/src/App.jsx`

## Security model

- Only an authenticated administrator can create, activate, block, or reset the
  password of a support account.
- Support staff have the `support` role and cannot use administrator APIs.
- Support agents only see their own assigned tickets plus unassigned tickets that
  match their specialization. Administrators retain explicit reassignment and
  supervision access.
- Ticket claims use a guarded database update so two agents cannot successfully
  claim the same unassigned ticket at the same time.
- Blocking an account or resetting its password invalidates its existing sessions.
- Support login state uses dedicated browser storage keys and does not replace a
  student's normal frontend login.
- Account deletion is intentionally not exposed. Blocking preserves ticket history
  and the identity of staff members who handled conversations.

## Removing the feature

Delete the three isolated feature folders, remove their route/sidebar imports, and
revert the integration points listed above. Existing support tickets should be kept;
assigned staff references can be cleared before removing the `support` user role.
