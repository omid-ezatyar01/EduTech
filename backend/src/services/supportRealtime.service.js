import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import User from "../models/User.js";
import SupportTicket from "../models/SupportTicket.js";
import SupportStaffProfile from "../modules/supportStaff/SupportStaffProfile.js";
import {
  normalizeSupportSpecialization,
  SPECIALIZATION_CATEGORIES,
} from "../modules/supportStaff/supportStaff.constants.js";

let io = null;
const supportConnections = new Map();
const supportLastSeen = new Map();

const normalizedOrigins = () =>
  String(process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const initializeSupportRealtime = (httpServer) => {
  const origins = normalizedOrigins();
  io = new Server(httpServer, {
    path: "/api/support-socket",
    cors: {
      origin: origins.length ? origins : true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || "").trim();
      if (!token) return next(new Error("Authentication required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id role status tokenVersion");
      if (!user || user.status === "blocked") return next(new Error("Account unavailable"));
      if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
        return next(new Error("Session expired"));
      }
      socket.user = user;
      return next();
    } catch {
      return next(new Error("Invalid session"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = String(socket.user._id);
    const joinSupportTicketRoom = async (ticketId) => {
      const normalizedTicketId = String(ticketId || "");
      if (!/^[a-f\d]{24}$/i.test(normalizedTicketId)) return false;
      const room = `support:ticket:${normalizedTicketId}`;
      if (socket.rooms.has(room)) return true;

      const ticket = await SupportTicket.findById(normalizedTicketId).select(
        "requester assignedTo category deletedAt",
      );
      let allowed =
        ticket &&
        !ticket.deletedAt &&
        (socket.user.role === "admin" ||
          String(ticket.requester) === userId);
      if (ticket && socket.user.role === "support") {
        const ownerId = String(ticket.assignedTo || "");
        if (ownerId === userId) {
          allowed = true;
        } else if (!ownerId) {
          const profile = await SupportStaffProfile.findOne({
            user: socket.user._id,
          }).lean();
          const specialization = normalizeSupportSpecialization(
            profile?.specialization,
          );
          const categories =
            SPECIALIZATION_CATEGORIES[specialization] || [];
          allowed =
            categories.length === 0 || categories.includes(ticket.category);
        } else {
          allowed = false;
        }
      }
      if (!allowed) return false;
      socket.join(room);
      return true;
    };

    socket.join(`support:user:${userId}`);
    if (socket.user.role === "support") {
      const profile = await SupportStaffProfile.findOne({
        user: socket.user._id,
      }).lean().catch(() => null);
      const specialization = normalizeSupportSpecialization(
        profile?.specialization,
      );
      const categories = SPECIALIZATION_CATEGORIES[specialization] || [];
      if (categories.length) {
        categories.forEach((category) =>
          socket.join(`support:category:${category}`),
        );
      } else {
        socket.join("support:agents");
      }
    }
    if (["admin", "support"].includes(socket.user.role)) {
      socket.join("support:team");
    }
    if (["admin", "support"].includes(socket.user.role)) {
      supportConnections.set(
        userId,
        Number(supportConnections.get(userId) || 0) + 1,
      );
      supportLastSeen.set(userId, new Date());
      io.to("support:team").emit("support:team-presence", {
        userId,
        online: true,
        lastSeenAt: supportLastSeen.get(userId),
      });
    }

    socket.on("support:join", async (ticketId, acknowledge = () => {}) => {
      try {
        const allowed = await joinSupportTicketRoom(ticketId);
        return acknowledge({ ok: allowed });
      } catch {
        return acknowledge({ ok: false });
      }
    });

    socket.on("support:leave", (ticketId) => {
      socket.leave(`support:ticket:${ticketId}`);
    });

    socket.on("support:typing", async ({ ticketId, isTyping } = {}) => {
      const normalizedTicketId = String(ticketId || "");
      const room = `support:ticket:${normalizedTicketId}`;
      if (!/^[a-f\d]{24}$/i.test(normalizedTicketId)) return;
      if (!socket.rooms.has(room)) {
        try {
          const allowed = await joinSupportTicketRoom(normalizedTicketId);
          if (!allowed) return;
        } catch {
          return;
        }
      }
      socket.to(room).emit("support:typing", {
        ticketId: normalizedTicketId,
        userId,
        role: socket.user.role,
        isTyping: Boolean(isTyping),
      });
    });

    socket.on(
      "support:team-typing",
      ({ conversationId, isTyping } = {}) => {
        if (!["admin", "support"].includes(socket.user.role)) return;
        const normalizedConversationId = String(conversationId || "");
        const data = {
          conversationId: normalizedConversationId,
          userId,
          role: socket.user.role,
          isTyping: Boolean(isTyping),
        };
        if (normalizedConversationId === "general") {
          socket.to("support:team").emit("support:team-typing", data);
          return;
        }
        if (!/^[a-f\d]{24}$/i.test(normalizedConversationId)) return;
        socket
          .to(`support:user:${normalizedConversationId}`)
          .emit("support:team-typing", data);
      },
    );

    socket.on("disconnect", () => {
      if (!["admin", "support"].includes(socket.user.role)) return;
      const remaining = Math.max(
        0,
        Number(supportConnections.get(userId) || 1) - 1,
      );
      if (remaining) {
        supportConnections.set(userId, remaining);
        return;
      }
      supportConnections.delete(userId);
      supportLastSeen.set(userId, new Date());
      io.to("support:team").emit("support:team-presence", {
        userId,
        online: false,
        lastSeenAt: supportLastSeen.get(userId),
      });
    });
  });

  return io;
};

export const getSupportPresenceSnapshot = () => ({
  onlineIds: [...supportConnections.keys()],
  lastSeenById: Object.fromEntries(
    [...supportLastSeen.entries()].map(([userId, value]) => [
      userId,
      value.toISOString(),
    ]),
  ),
});

export const isSupportUserOnline = (userId) =>
  Number(supportConnections.get(String(userId || "")) || 0) > 0;

export const emitSupportTeamMessage = ({
  recipientId = "",
  data,
  event = "support:team-message",
}) => {
  if (!io) return;
  if (recipientId) {
    io.to(`support:user:${recipientId}`)
      .to(
        `support:user:${String(
          data?.message?.sender?.id || data?.senderId || "",
        )}`,
      )
      .emit(event, data);
    return;
  }
  io.to("support:team").emit(event, data);
};

export const emitSupportUserEvent = (userId, event, data) => {
  if (!io || !userId || !event) return;
  io.to(`support:user:${String(userId)}`).emit(event, data);
};

export const disconnectSupportUser = (userId) => {
  if (!io || !userId) return;
  io.in(`support:user:${String(userId)}`).disconnectSockets(true);
};

export const emitSupportEvent = ({ ticket, event, data, supportOnly = false }) => {
  if (!io || !ticket) return;
  const ticketId = String(ticket._id || ticket.id || "");
  const requesterId = String(ticket.requester?._id || ticket.requester || "");
  const category = String(ticket.category || "");
  let supportRecipients = io.to("support:agents");
  if (category) {
    supportRecipients = supportRecipients.to(`support:category:${category}`);
  }
  if (supportOnly) {
    if (ticketId) {
      supportRecipients = supportRecipients.to(`support:ticket:${ticketId}`);
    }
    supportRecipients.emit(event, data);
    return;
  }
  let recipients = supportRecipients;
  if (requesterId) recipients = recipients.to(`support:user:${requesterId}`);
  if (ticketId) recipients = recipients.to(`support:ticket:${ticketId}`);
  recipients.emit(event, data);
};
