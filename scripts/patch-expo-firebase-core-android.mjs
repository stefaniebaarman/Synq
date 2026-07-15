/**
 * expo-firebase-core (pulled in by deprecated expo-firebase-recaptcha) uses
 * compileSdkVersion, which modern AGP rejects. Patch Android only so EAS
 * builds succeed without changing iOS phone-auth behavior.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildGradle = path.join(
  root,
  "node_modules",
  "expo-firebase-core",
  "android",
  "build.gradle"
);

if (!fs.existsSync(buildGradle)) {
  console.log("[patch-expo-firebase-core-android] skip: package not installed");
  process.exit(0);
}

const marker = "patched-for-agp-compileSdk";
const contents = fs.readFileSync(buildGradle, "utf8");
if (contents.includes(marker)) {
  console.log("[patch-expo-firebase-core-android] already applied");
  process.exit(0);
}

const patched = [
  `// ${marker}`,
  "apply plugin: 'com.android.library'",
  "apply plugin: 'kotlin-android'",
  "apply plugin: 'maven-publish'",
  "",
  "group = 'host.exp.exponent'",
  "version = '6.0.0'",
  "",
  "buildscript {",
  '  def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")',
  "  if (expoModulesCorePlugin.exists()) {",
  "    apply from: expoModulesCorePlugin",
  "    applyKotlinExpoModulesCorePlugin()",
  "  }",
  "",
  "  // Simple helper that allows the root project to override versions declared by this library.",
  "  ext.safeExtGet = { prop, fallback ->",
  "    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback",
  "  }",
  "",
  "  // Ensures backward compatibility",
  "  ext.getKotlinVersion = {",
  '    if (ext.has("kotlinVersion")) {',
  "      ext.kotlinVersion()",
  "    } else {",
  '      ext.safeExtGet("kotlinVersion", "1.6.10")',
  "    }",
  "  }",
  "",
  "  repositories {",
  "    mavenCentral()",
  "  }",
  "",
  "  dependencies {",
  '    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${getKotlinVersion()}")',
  "  }",
  "}",
  "",
  "android {",
  '  namespace "expo.modules.firebase.core"',
  '  compileSdk safeExtGet("compileSdkVersion", 35)',
  "",
  "  compileOptions {",
  "    sourceCompatibility JavaVersion.VERSION_17",
  "    targetCompatibility JavaVersion.VERSION_17",
  "  }",
  "",
  "  kotlinOptions {",
  "    jvmTarget = JavaVersion.VERSION_17.majorVersion",
  "  }",
  "",
  "  defaultConfig {",
  '    minSdkVersion safeExtGet("minSdkVersion", 24)',
  '    targetSdkVersion safeExtGet("targetSdkVersion", 35)',
  "    versionCode 10",
  "    versionName '6.0.0'",
  "  }",
  "  lintOptions {",
  "    abortOnError false",
  "  }",
  "}",
  "",
  "dependencies {",
  "  implementation project(':expo-modules-core')",
  "  api 'com.google.firebase:firebase-core:21.1.0'",
  "  api 'com.google.firebase:firebase-common:20.1.1'",
  '  implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:${getKotlinVersion()}"',
  "}",
  "",
].join("\n");

fs.writeFileSync(buildGradle, patched, "utf8");
console.log("[patch-expo-firebase-core-android] patched", buildGradle);
