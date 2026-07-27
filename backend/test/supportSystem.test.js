import assert from "node:assert/strict";
import test from "node:test";
import SupportMessage from "../src/models/SupportMessage.js";
import SupportTicket from "../src/models/SupportTicket.js";
import {
  createSupportTicketSchema,
  requesterTicketActionSchema,
  sendSupportMessageSchema,
  supportTicketListSchema,
  updateSupportTicketSchema,
} from "../src/validators/support.validators.js";
import { buildAdminSupportTicketFilter } from "../src/controllers/supportController.js";

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

test("ticket creation accepts supported categories and rejects oversized messages", () => {
  const valid = createSupportTicketSchema.validate({
    subject: "Payment confirmation",
    category: "payment",
    message: "My payment is still pending.",
  });
  assert.equal(valid.error, undefined);

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
