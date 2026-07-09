import ApiError from "../utils/ApiError.js";

const validateRequest = (schema, source = "body") => {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join(", ");
      return next(new ApiError(400, message, error.details));
    }

    if (!req.validated) {
      req.validated = {};
    }

    req.validated[source] = value;

    if (source === "query") {
      const queryRef = req.query || {};
      Object.keys(queryRef).forEach((key) => {
        delete queryRef[key];
      });
      Object.assign(queryRef, value);
    } else {
      req[source] = value;
    }

    return next();
  };
};

export default validateRequest;
