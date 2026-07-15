// @inkd/ui — design system entry point.
// Re-exports the canonical design tokens. Shared component primitives will be
// added here as web + React Native (NativeWind) reach parity.
const tokens = require("./tokens.cjs");

module.exports = { tokens };
module.exports.tokens = tokens;
module.exports.default = tokens;
