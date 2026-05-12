import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/http.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.errors?.[0]?.message ?? "Invalid request payload.",
        details: err.errors
      }
    });
  }

  console.error(err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    }
  });
};
