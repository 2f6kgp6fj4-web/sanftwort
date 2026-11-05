// Zeigt im iOS-Teilen-Menü "Sanftwort" an. Der Ziel-Ordner der Erweiterung darf nicht
// genauso heißen wie die App, deshalb heißt er "SanftwortShare" – hier wird nur der
// sichtbare Name zurückgesetzt.
const { withXcodeProject } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");
const plist = require("@expo/plist").default;

module.exports = function withShareDisplayName(config, { folder = "SanftwortShare", name = "Sanftwort" } = {}) {
  // expo-share-intent schreibt seine Dateien im Xcode-Projekt-Mod, daher hier derselbe Mod.
  return withXcodeProject(config, async (cfg) => {
    {
      const file = path.join(cfg.modRequest.platformProjectRoot, folder, "ShareExtension-Info.plist");
      if (fs.existsSync(file)) {
        const data = plist.parse(fs.readFileSync(file, "utf8"));
        data.CFBundleDisplayName = name;
        fs.writeFileSync(file, plist.build(data));
      } else {
        console.warn(`[withShareDisplayName] ${file} nicht gefunden`);
      }
      return cfg;
    }
  });
};
