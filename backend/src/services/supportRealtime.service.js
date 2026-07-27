import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import User from "../models/User.js";
import SupportTicket from "../models/SupportTicket.js";

let io = null;

const normalizedOrigins = () =>
  String(process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const initializeSupportRealtime = (httpServer) => {
  const origins = normalizedOrigins();
  io = new Server(httpServer, {
    path: "/support-socket",
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

  io.on("connection", (socket) => {
    const userId = String(socket.user._id);
    socket.join(`support:user:${userId}`);
    if (socket.user.role === "admin") socket.join("support:agents");

    socket.on("support:join", async (ticketId, acknowledge = () => {}) => {
      try {
        const ticket = await SupportTicket.findById(ticketId).select("requester");
        const allowed =
          ticket &&
          (socket.user.role === "admin" || String(ticket.requester) === userId);
        if (!allowed) return acknowledge({ ok: false });
        socket.join(`support:ticket:${ticketId}`);
        return acknowledge({ ok: true });
      } catch {
        return acknowledge({ ok: false });
      }
    });

    socket.on("support:leave", (ticketId) => {
      socket.leave(`support:ticket:${ticketId}`);
    });
  });

  return io;
};

export const emitSupportEvent = ({ ticket, event, data, supportOnly = false }) => {
  if (!io || !ticket) return;
  const ticketId = String(ticket._id || ticket.id || "");
  const requesterId = String(ticket.requester?._id || ticket.requester || "");
  if (supportOnly) {
    io.to("support:agents").emit(event, data);
    return;
  }
  let recipients = io.to("support:agents");
  if (requesterId) recipients = recipients.to(`support:user:${requesterId}`);
  if (ticketId) recipients = recipients.to(`support:ticket:${ticketId}`);
  recipients.emit(event, data);
};
