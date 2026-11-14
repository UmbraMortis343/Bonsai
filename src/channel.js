// Which copy of Bonsai this is: "" for the released app, "beta" for the test copy at /beta/.
// The build stamps the name in; the beta keeps its own database and settings.
export const CHANNEL = "__CHANNEL__" === "beta" ? "beta" : "";
