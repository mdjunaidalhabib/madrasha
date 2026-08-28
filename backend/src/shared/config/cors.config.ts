import { env } from "./env";

// The server-side PDF export's headless browser loads the report page from
// internalFrontendUrl (e.g. "http://madrasha-frontend-internal"), not the
// public frontend domain (see report-export.service.ts) - so that page's own
// API calls carry that internal origin, which was never going to be in
// corsOrigins (a real deployment only lists its public frontend domain
// there). Without allowing it too, every one of that page's requests fails
// CORS, and it renders with no data - added automatically here instead of
// requiring it to be hand-added to CORS_ORIGIN in every deployment's env.
const internalFrontendOrigin = (() => {
  if (!env.internalFrontendUrl) return null;
  try {
    return new URL(env.internalFrontendUrl).origin;
  } catch {
    return null;
  }
})();

export const corsConfig = {
  origins: internalFrontendOrigin
    ? [...env.corsOrigins, internalFrontendOrigin]
    : env.corsOrigins,
  credentials: true,
};
