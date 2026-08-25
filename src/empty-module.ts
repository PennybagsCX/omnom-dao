/**
 * Empty module stub.
 *
 * Used as a resolve-alias target for native/peer modules referenced by
 * wallet SDKs (pino-pretty, pino/file, @react-native-async-storage) that
 * this web-only app never needs at runtime. Mapping them here keeps both
 * the Turbopack and webpack bundles warning-free.
 */
const emptyModule = {};

export default emptyModule;
