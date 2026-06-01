import { env } from "./env.js";

console.log("Backend environment is valid.");
console.log({
  node_env: env.NODE_ENV,
  port: env.PORT,
  database_url_present: Boolean(env.DATABASE_URL),
  jwt_secret_present: Boolean(env.JWT_SECRET),
  cors_origin: env.CORS_ORIGIN,
  nlp_service_url: env.NLP_SERVICE_URL,
  nlp_timeout_ms: env.NLP_TIMEOUT_MS
});
