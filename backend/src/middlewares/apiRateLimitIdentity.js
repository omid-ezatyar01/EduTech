import jwt from "jsonwebtoken";
import { ipKeyGenerator } from "express-rate-limit";

const identityCache = Symbol("apiRateLimitIdentity");

const resolveIpKey = (req) => {
  const address =
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown";
  return `ip:${ipKeyGenerator(address)}`;
};

export const resolveApiRateLimitIdentity = (
  req,
  jwtSecret = process.env.JWT_SECRET,
) => {
  if (req[identityCache]) return req[identityCache];

  const authorization = String(req.headers?.authorization || "").trim();
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (token && jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret);
      const accountId = String(decoded?.id || decoded?._id || decoded?.sub || "").trim();
      if (accountId) {
        req[identityCache] = {
          authenticated: true,
          key: `account:${accountId}`,
        };
        return req[identityCache];
      }
    } catch {
      // Invalid or expired tokens remain limited by IP.
    }
  }

  req[identityCache] = {
    authenticated: false,
    key: resolveIpKey(req),
  };
  return req[identityCache];
};

export const apiRateLimitKey = (req) =>
  resolveApiRateLimitIdentity(req).key;
