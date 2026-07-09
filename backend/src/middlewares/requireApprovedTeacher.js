import ApiError from "../utils/ApiError.js";

const requireApprovedTeacher = ({ allowAdmin = true } = {}) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authorized, user not found"));
    }

    if (allowAdmin && req.user.role === "admin") {
      return next();
    }

    if (req.user.role !== "teacher") {
      return next(new ApiError(403, "Not authorized for this resource"));
    }

    const applicationStatus = String(req.user?.teacherApplication?.status || "");
    if (applicationStatus !== "approved") {
      return next(
        new ApiError(
          403,
          "Your teacher profile is not approved by admin yet. Please complete and submit your profile form.",
        ),
      );
    }

    return next();
  };
};

export default requireApprovedTeacher;
