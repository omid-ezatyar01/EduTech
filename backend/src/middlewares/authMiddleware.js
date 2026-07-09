import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { blockTeacherIfContractExpired } from "../utils/teacherContract.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Not authorized, no token",
    });
  }

  try {
    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select(
      "-password -emailOtpHash -emailOtpExpiresAt -emailOtpAttempts",
    );

    if (!user) {
      return res.status(401).json({
        message: "Not authorized, user not found",
      });
    }

    if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({
        message: "Password changed. Please login again",
      });
    }

    const didExpireContract = await blockTeacherIfContractExpired(user);
    if (didExpireContract) {
      return res.status(403).json({
        message: "Your teacher account contract has expired and the account was blocked",
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        message: "Your account has been blocked",
      });
    }

    if (user.role === "student" && (!user.isEmailVerified || user.status === "pending_verification")) {
      return res.status(403).json({
        message: "Please verify your email before continuing",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token failed",
    });
  }
};

export const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized as an admin",
  });
};

export const teacher = (req, res, next) => {
  if (req.user && (req.user.role === "teacher" || req.user.role === "admin")) {
    return next();
  }

  return res.status(403).json({
    message: "Not authorized as a teacher",
  });
};

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for this resource",
      });
    }

    return next();
  };
};
