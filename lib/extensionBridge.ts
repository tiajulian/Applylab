// Must match the ID Chrome derives from the "key" field in extension/manifest.json.
// Pinning that key keeps the extension's ID stable across every "Load unpacked" install
// (Chrome otherwise assigns a random ID per unpacked folder), so this constant works for
// every user who downloads the ZIP, not just one specific install.
export const APPLYLAB_EXTENSION_ID = "pholaaidghgicfpbpbecejfmjglpmjdh";
