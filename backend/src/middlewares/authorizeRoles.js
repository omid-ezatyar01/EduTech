import ApiError from "../utils/ApiError.js";

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authorized, user not found"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Not authorized for this resource"));
    }

    return next();
  };
};

export default authorizeRoles;
