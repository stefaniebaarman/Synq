/**
 * CocoaPods downloads Firebase iOS artifacts from https://dl.google.com/...
 * If DNS cannot resolve dl.google.com, pod install fails with curl (6).
 * Run before local pod install or EAS iOS builds: npm run verify:ios-pod-network
 */
import dns from "node:dns/promises";
import https from "node:https";

const HOST = "dl.google.com";
const PATH = "/";

function httpsHead(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, port: 443, path, method: "HEAD", timeout: 15000 },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("HTTPS timeout"));
    });
    req.end();
  });
}

async function main() {
  console.log(`Checking DNS and HTTPS for ${HOST} (required for FirebaseAnalytics CocoaPods)...\n`);

  try {
    const lookup = await dns.lookup(HOST);
    console.log(`OK  DNS: ${HOST} -> ${lookup.address}`);
  } catch (e) {
    console.error(`FAIL DNS: Could not resolve ${HOST}`);
    console.error(`      ${e?.message || e}`);
    console.error("\nFix: check VPN/firewall, set DNS to 8.8.8.8 or 1.1.1.1, or ask IT to allow dl.google.com.");
    process.exit(1);
  }

  try {
    const code = await httpsHead(HOST, PATH);
    console.log(`OK  HTTPS: HEAD ${HOST}${PATH} -> ${code}`);
  } catch (e) {
    console.error(`FAIL HTTPS to ${HOST}: ${e?.message || e}`);
    console.error("\nFix: ensure outbound HTTPS to Google is allowed (no TLS inspection blocking).");
    process.exit(1);
  }

  console.log("\nNetwork looks fine for CocoaPods Firebase downloads. You can run pod install / EAS iOS build.");
}

main();
