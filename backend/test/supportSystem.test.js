import assert from "node:assert/strict";
import test from "node:test";
import SupportMessage from "../src/models/SupportMessage.js";
import SupportTicket from "../src/models/SupportTicket.js";
import PushSubscription from "../src/models/PushSubscription.js";
import User from "../src/models/User.js";
import SupportTeamMessage from "../src/modules/supportStaff/SupportTeamMessage.js";
import SupportStaffProfile from "../src/modules/supportStaff/SupportStaffProfile.js";
import {
  SPECIALIZATION_CATEGORIES,
  SUPPORT_SPECIALIZATIONS,
} from "../src/modules/supportStaff/supportStaff.constants.js";
import {
  createSupportTicketSchema,
  requesterTicketActionSchema,
  sendSupportMessageSchema,
  supportTicketListSchema,
  updateSupportTicketSchema,
} from "../src/validators/support.validators.js";
import {
  buildAdminSupportTicketFilter,
  isSupportAgent,
} from "../src/controllers/supportController.js";
import {
  createSupportStaffSchema,
  resetSupportStaffPasswordSchema,
  sendSupportTeamMessageSchema,
  supportConversationSchema,
  updateSupportStaffSchema,
} from "../src/modules/supportStaff/supportStaff.validators.js";

const objectId = "507f1f77bcf86cd799439011";

test("support tickets default to an open normal-priority conversation", () => {
  const ticket = new SupportTicket({
    ticketNumber: "SUP-TEST-100",
    requester: objectId,
    requesterRole: "student",
    subject: "Cannot enter my class",
    category: "technical",
    lastSenderRole: "student",
  });

  assert.equal(ticket.status, "open");
  assert.equal(ticket.priority, "normal");
  assert.equal(ticket.unreadForSupport, 1);
  assert.equal(ticket.unreadForRequester, 0);
  assert.equal(ticket.claimedAt, null);
  assert.equal(ticket.lastAssignedAt, null);
  assert.equal(ticket.handoffCount, 0);
  assert.equal(ticket.deletedAt, null);
  assert.equal(ticket.deletedBy, null);
});

test("support staff devices can register for server push notifications", async () => {
  const subscription = new PushSubscription({
    userId: objectId,
    role: "support",
    app: "support",
    endpoint: "https://push.example.com/support/device-1",
    keys: {
      p256dh: "test-public-key",
      auth: "test-auth-key",
    },
  });
  await subscription.validate();
  assert.equal(subscription.role, "support");
  assert.equal(subscription.app, "support");
});

test("support messages distinguish private staff notes from user-visible replies", () => {
  const note = new SupportMessage({
    ticket: objectId,
    sender: objectId,
    senderRole: "admin",
    body: "Ask the payment team to verify this.",
    internalNote: true,
  });

  assert.equal(note.internalNote, true);
  assert.equal(note.body, "Ask the payment team to verify this.");
});

test("support role is isolated from student, teacher, and admin roles", async () => {
  const user = new User({
    name: "Support Agent",
    email: "support@example.com",
    phone: "0700000000",
    password: "SecurePass1",
    role: "support",
    status: "active",
    isEmailVerified: true,
  });
  await user.validate();
  assert.equal(isSupportAgent(user), true);
  assert.equal(isSupportAgent({ role: "admin" }), true);
  assert.equal(isSupportAgent({ role: "teacher" }), false);
});

test("admin support-account validation enforces strong credentials and safe updates", () => {
  assert.equal(
    createSupportStaffSchema.validate({
      name: "Support Agent",
      email: "agent@example.com",
      phone: "0700000000",
      password: "SecurePass1",
      specialization: "technical",
    }).error,
    undefined,
  );
  assert.ok(
    createSupportStaffSchema.validate({
      name: "Agent",
      email: "agent@example.com",
      phone: "0700000000",
      password: "weak",
      specialization: "technical",
    }).error,
  );
  assert.equal(updateSupportStaffSchema.validate({ status: "blocked" }).error, undefined);
  assert.ok(updateSupportStaffSchema.validate({ status: "admin" }).error);
  assert.equal(
    resetSupportStaffPasswordSchema.validate({ password: "AnotherPass2" }).error,
    undefined,
  );
});

test("support staff specializations validate and map to ticket categories", async () => {
  const profile = new SupportStaffProfile({
    user: objectId,
    specialization: "payments",
  });
  await profile.validate();
  assert.equal(profile.specialization, "payments");
  assert.deepEqual(SPECIALIZATION_CATEGORIES.payments, ["payment"]);
  assert.ok(SUPPORT_SPECIALIZATIONS.includes("technical"));
  assert.ok(SUPPORT_SPECIALIZATIONS.includes("contact"));

  const invalid = new SupportStaffProfile({
    user: objectId,
    specialization: "super_admin",
  });
  await assert.rejects(() => invalid.validate());
});

test("ticket creation accepts supported categories and rejects oversized messages", () => {
  const valid = createSupportTicketSchema.validate({
    subject: "Consultation",
    category: "consultation",
    message: "I need advice about choosing a course.",
  });
  assert.equal(valid.error, undefined);
  assert.deepEqual(
    SPECIALIZATION_CATEGORIES.contact,
    ["account", "consultation", "registration", "feedback", "complaint", "other"],
  );

  const invalid = createSupportTicketSchema.validate({
    subject: "Payment confirmation",
    category: "payment",
    message: "x".repeat(4001),
  });
  assert.ok(invalid.error);
});

test("requesters can only open or close their own ticket status", () => {
  assert.equal(requesterTicketActionSchema.validate({ status: "closed" }).error, undefined);
  assert.ok(requesterTicketActionSchema.validate({ status: "resolved" }).error);
  assert.ok(requesterTicketActionSchema.validate({ priority: "urgent" }).error);
});

test("admin ticket updates validate status, priority, and assignment", () => {
  assert.equal(
    updateSupportTicketSchema.validate({
      status: "waiting_for_user",
      priority: "urgent",
      assignedTo: objectId,
    }).error,
    undefined,
  );
  assert.ok(updateSupportTicketSchema.validate({ priority: "emergency" }).error);
  assert.equal(
    updateSupportTicketSchema.validate({
      assignedTo: null,
      handoffReason: "Needs help from the payment specialist",
    }).error,
    undefined,
  );
  assert.ok(
    updateSupportTicketSchema.validate({
      assignedTo: null,
      handoffReason: "no",
    }).error,
  );
});

test("support list filters receive safe pagination defaults and message limits are enforced", () => {
  const list = supportTicketListSchema.validate({});
  assert.equal(list.error, undefined);
  assert.equal(list.value.page, 1);
  assert.equal(list.value.limit, 30);
  assert.equal(list.value.status, "all");
  assert.equal(list.value.category, "all");

  assert.ok(sendSupportMessageSchema.validate({ body: "" }).error);
  assert.ok(sendSupportMessageSchema.validate({ body: "x".repeat(4001) }).error);
  assert.equal(sendSupportMessageSchema.validate({ body: "Hello support" }).error, undefined);
});

test("admin support queue never filters every ticket with missing optional values", () => {
  assert.deepEqual(buildAdminSupportTicketFilter({}), {});
  assert.deepEqual(
    buildAdminSupportTicketFilter({
      status: "all",
      category: undefined,
      priority: "all",
      requesterRole: "all",
    }),
    {},
  );
  assert.deepEqual(
    buildAdminSupportTicketFilter({ requesterRole: "teacher" }),
    { requesterRole: "teacher" },
  );
});

test("support team messages separate the shared room from direct conversations", async () => {
  const direct = new SupportTeamMessage({
    conversationType: "direct",
    sender: objectId,
    recipient: "507f191e810c19729de860ea",
    body: "Can you take the payment ticket?",
    readBy: [objectId],
  });
  await direct.validate();
  assert.equal(direct.channel, undefined);
  assert.equal(String(direct.recipient), "507f191e810c19729de860ea");

  const channel = new SupportTeamMessage({
    conversationType: "channel",
    sender: objectId,
    body: "The payment provider is delayed.",
    readBy: [objectId],
  });
  await channel.validate();
  assert.equal(channel.channel, "general");
  assert.equal(channel.recipient, null);
});

test("support team conversation validation rejects unsafe targets and empty messages", () => {
  assert.equal(
    supportConversationSchema.validate({ conversationId: "general" }).error,
    undefined,
  );
  assert.equal(
    supportConversationSchema.validate({ conversationId: objectId }).error,
    undefined,
  );
  assert.ok(
    supportConversationSchema.validate({ conversationId: "../admin" }).error,
  );
  assert.equal(
    sendSupportTeamMessageSchema.validate({ body: "Team update" }).error,
    undefined,
  );
  assert.ok(sendSupportTeamMessageSchema.validate({ body: "" }).error);
});
