import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const frontPkg = JSON.parse(read("Frontend/package.json"));
const versionInfo = JSON.parse(read("version.json"));
const builder = read("electron-builder.yml");
const getYaml = (key) => builder.match(new RegExp(`^\\s*${key}:\\s*["']?([^\\s"']+)`, "m"))?.[1];
const owner = getYaml("owner");
const repo = getYaml("repo");
const artifact = getYaml("artifactName");
const appId = getYaml("appId");
assert.equal(getYaml("provider"), "github", "GitHub is the update provider");
assert.equal(getYaml("releaseType"), "release", "updater targets normal releases");
assert.ok(owner && repo, "GitHub owner and repository are set");
assert.ok(appId, "stable appId is set");
assert.ok(artifact?.includes("${version}") && artifact.includes("${ext}"), "installer artifact name includes version and extension");
assert.match(builder, /target:\s*\r?\n\s*- nsis/m, "Windows installer target is NSIS");
assert.doesNotMatch(builder, /Backend\\?\.env["']?\s*$/m, "installer configuration does not add Backend/.env as an asset");
assert.equal(pkg.version, versionInfo.current, "package version equals version.json current");
assert.equal(frontPkg.version, pkg.version, "frontend package version equals root package version");
const remote = pkg.repository?.url?.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i);
assert.ok(remote, "package repository identifies the published GitHub repository");
assert.equal(remote[1].toLowerCase(), owner.toLowerCase(), "publish owner matches source repository owner");
assert.equal(remote[2].toLowerCase(), "tailor-management-system", "source repository remains the app-code repository");
assert.equal(owner.toLowerCase(), "pashto-devzone", "release owner is configured correctly");
assert.equal(repo.toLowerCase(), "pashto-devzone", "release repo is the dedicated profile/release repository");
console.log(`PASS: source repo ${remote[1]}/${remote[2]} is separate from release repo ${owner}/${repo}.`);
console.log(`PASS: updater config; appId ${appId}, artifact ${artifact}, version ${pkg.version}.`);
console.log("PASS: NSIS target and required latest.yml/.blockmap-capable publish config are present; Backend/.env is excluded.");

const base = `https://api.github.com/repos/${owner}/${repo}`;
const request = async (url) => fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "tailor-management-updater-config-check" }, signal: AbortSignal.timeout(7000) });
try {
  const repoResponse = await request(base);
  if (!repoResponse.ok) throw new Error(`GitHub repository lookup returned HTTP ${repoResponse.status}`);
  const repository = await repoResponse.json();
  console.log(`NETWORK: repository is ${repository.private ? "private" : "public"}.`);
  try {
    const latestResponse = await request(`${base}/releases/latest`);
    if (latestResponse.status === 404) {
      console.log("NETWORK: no published latest release is available yet (404); publish one normal release with assets.");
    } else if (!latestResponse.ok) {
      console.log(`NETWORK: latest release lookup unavailable (HTTP ${latestResponse.status}).`);
    } else {
      const release = await latestResponse.json();
      const assets = (release.assets || []).map((asset) => asset.name);
      const installerPattern = new RegExp(`^Tailor Management System-Setup-${release.tag_name.replace(/^v/, "")}\\.exe$`, "i");
      console.log(`NETWORK: latest tag ${release.tag_name}; draft=${release.draft}; prerelease=${release.prerelease}.`);
      console.log(`NETWORK: assets latest.yml=${assets.some((name) => name.toLowerCase() === "latest.yml")}, .exe=${assets.some((name) => installerPattern.test(name))}, .blockmap=${assets.some((name) => name.toLowerCase().endsWith(".exe.blockmap"))}.`);
    }
  } catch (error) {
    console.log(`NETWORK: release check skipped (${error.message}).`);
  }
} catch (error) {
  console.log(`NETWORK: GitHub check skipped (${error.message}).`);
}
