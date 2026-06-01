import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/http.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId;

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        request_id: requestId
      }
    });
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.errors?.[0]?.message ?? "Invalid request payload.",
        details: err.errors,
        request_id: requestId
      }
    });
  }

  console.error({ requestId, err });
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      request_id: requestId
    }
  });
};
