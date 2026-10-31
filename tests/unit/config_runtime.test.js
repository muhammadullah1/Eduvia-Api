"use strict";

const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const runtime = require("../../config/runtime");

const STRONG_SECRET = "s".repeat(runtime.MIN_JWT_SECRET_LENGTH);
// Placeholder values only: the checks look at presence and shape, never at real credentials.
const COMPLETE_STAGE_ENV = {
  DATABASE_HOST: "db.example.com",
  DATABASE_PORT: "5432",
  DATABASE_NAME: "eduvia_stage",
  DATABASE_USERNAME: "eduvia",
  DATABASE_PASSWORD: "placeholder",
  JWT_SECRET: STRONG_SECRET,
  FRONT_END_URL: "https://stage.example.com",
  ALLOWED_ORIGINS: "https://stage.example.com, https://preview.example.com/",
  CLOUDFLARE_R2_ACCESS_KEY_ID: "placeholder",
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: "placeholder",
  CLOUDFLARE_R2_BUCKET: "eduvia-stage",
  CLOUDFLARE_R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  RESEND_API_KEY: "placeholder",
  EMAIL_FROM: "noreply@example.com",
};

describe("cookieSettings", () => {
  test.each(["development", "test"])(
    "%s defaults to Lax and not Secure",
    (env) => {
      expect(runtime.cookieSettings(env)).toEqual({
        secure: false,
        sameSite: "lax",
      });
    },
  );

  test.each(["staging", "production"])(
    "%s defaults to SameSite=None and Secure",
    (env) => {
      expect(
        runtime.cookieSettings(env, { secure: "", sameSite: "", domain: "" }),
      ).toEqual({ secure: true, sameSite: "none" });
    },
  );

  test("explicit values override and the domain is passed through", () => {
    expect(
      runtime.cookieSettings("staging", {
        secure: "TRUE",
        sameSite: "Strict",
        domain: " .example.com ",
      }),
    ).toEqual({
      secure: true,
      sameSite: "strict",
      domain: ".example.com",
    });
    expect(
      runtime.cookieSettings("development", {
        secure: "true",
        sameSite: "none",
      }),
    ).toEqual({ secure: true, sameSite: "none" });
  });

  test("SameSite=None without Secure is refused", () => {
    expect(() =>
      runtime.cookieSettings("development", { sameSite: "none" }),
    ).toThrow(/requires COOKIE_SECURE=true/);
    expect(() =>
      runtime.cookieSettings("staging", { secure: "false" }),
    ).toThrow(/requires COOKIE_SECURE=true/);
  });

  test("an insecure cookie is refused in deployed environments even with Lax", () => {
    expect(() =>
      runtime.cookieSettings("production", {
        secure: "false",
        sameSite: "lax",
      }),
    ).toThrow(/can't be false in production/);
  });

  test("invalid values are rejected", () => {
    expect(() =>
      runtime.cookieSettings("development", { sameSite: "sometimes" }),
    ).toThrow(/COOKIE_SAMESITE/);
    expect(() =>
      runtime.cookieSettings("development", { secure: "yes" }),
    ).toThrow(/COOKIE_SECURE/);
  });
});

describe("trustProxySetting", () => {
  test("defaults per environment", () => {
    expect(runtime.trustProxySetting("staging")).toBe(1);
    expect(runtime.trustProxySetting("production", "")).toBe(1);
    expect(runtime.trustProxySetting("development")).toBe(false);
    expect(runtime.trustProxySetting("test", "")).toBe(false);
  });

  test("accepts booleans, hop counts and trust strings", () => {
    expect(runtime.trustProxySetting("staging", "2")).toBe(2);
    expect(runtime.trustProxySetting("staging", "false")).toBe(false);
    expect(runtime.trustProxySetting("development", "True")).toBe(true);
    expect(runtime.trustProxySetting("staging", "loopback")).toBe("loopback");
  });
});

describe("parseOrigins (CORS allow-list)", () => {
  test("trims, drops trailing slashes and blanks", () => {
    expect(
      runtime.parseOrigins(
        " https://a.example.com/ ,, https://b.example.com//,",
      ),
    ).toEqual(["https://a.example.com", "https://b.example.com"]);
  });
});

describe("deployProblems", () => {
  test("development and test never require deploy variables", () => {
    expect(runtime.deployProblems("development", {})).toEqual([]);
    expect(runtime.deployProblems("test", {})).toEqual([]);
  });

  test("a complete staging environment passes", () => {
    expect(runtime.deployProblems("staging", COMPLETE_STAGE_ENV)).toEqual([]);
  });

  test("lists every missing variable by name", () => {
    const problems = runtime.deployProblems("production", {});
    expect(problems.join("\n")).toContain(
      "Missing: DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD, JWT_SECRET, FRONT_END_URL, " +
        "ALLOWED_ORIGINS, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ENDPOINT, " +
        "RESEND_API_KEY, EMAIL_FROM",
    );
  });

  test("rejects the default and short JWT secrets", () => {
    const withDefault = {
      ...COMPLETE_STAGE_ENV,
      JWT_SECRET: runtime.DEFAULT_JWT_SECRET,
    };
    const withShort = { ...COMPLETE_STAGE_ENV, JWT_SECRET: "short-secret" };
    expect(runtime.deployProblems("staging", withDefault).join()).toMatch(
      /JWT_SECRET/,
    );
    expect(runtime.deployProblems("staging", withShort).join()).toMatch(
      /JWT_SECRET/,
    );
  });

  test("rejects localhost and http front-end URLs and origins", () => {
    const local = {
      ...COMPLETE_STAGE_ENV,
      FRONT_END_URL: "http://localhost:5173",
      ALLOWED_ORIGINS: "https://ok.example.com,http://localhost:5173",
    };
    const text = runtime.deployProblems("staging", local).join("\n");
    expect(text).toMatch(/FRONT_END_URL/);
    expect(text).toMatch(/ALLOWED_ORIGINS.*http:\/\/localhost:5173/);
    expect(text).not.toMatch(/ok\.example\.com/);
  });

  test("assertDeployable throws one error naming the problems", () => {
    expect(() =>
      runtime.assertDeployable("staging", {
        ...COMPLETE_STAGE_ENV,
        RESEND_API_KEY: "",
      }),
    ).toThrow(/Missing: RESEND_API_KEY/);
    expect(() =>
      runtime.assertDeployable("staging", COMPLETE_STAGE_ENV),
    ).not.toThrow();
  });
});

describe("config startup (child process, no database)", () => {
  const configPath = path.resolve(__dirname, "../../config");
  // Run outside the repo so no local .env is picked up; only PATH and the variables under test are passed.
  const loadConfig = (env) =>
    spawnSync(
      process.execPath,
      ["-e", `require(${JSON.stringify(configPath)}); console.log("loaded")`],
      {
        cwd: os.tmpdir(),
        env: { PATH: process.env.PATH, ...env },
        encoding: "utf8",
      },
    );

  test("staging with missing variables exits non-zero and names them", () => {
    const result = loadConfig({
      NODE_ENV: "staging",
      DATABASE_HOST: "db.example.com",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/can't start in staging/);
    expect(result.stderr).toMatch(/JWT_SECRET/);
    expect(result.stderr).not.toMatch(/Missing: DATABASE_HOST/);
    expect(result.stdout).not.toMatch(/loaded/);
  });

  test("staging maps DB, storage, CORS and cookie settings from the environment", () => {
    const sequelizePath = path.resolve(
      __dirname,
      "../../config/forSequelizeCLI",
    );
    const script = `
      const config = require(${JSON.stringify(configPath)});
      const db = require(${JSON.stringify(sequelizePath)});
      const { parseOrigins, cookieSettings, trustProxySetting } = require(${JSON.stringify(path.resolve(__dirname, "../../config/runtime"))});
      console.log(JSON.stringify({
        db,
        r2: config.get("r2"),
        origins: parseOrigins(config.get("allowedOrigins")),
        cookie: cookieSettings(config.get("env"), config.get("cookie")),
        trustProxy: trustProxySetting(config.get("env"), config.get("trustProxy")),
      }));`;
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: os.tmpdir(),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "staging",
        ...COMPLETE_STAGE_ENV,
      },
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    const loaded = JSON.parse(result.stdout);
    expect(loaded.db).toMatchObject({
      dialect: "postgres",
      host: "db.example.com",
      port: 5432,
      database: "eduvia_stage",
      username: "eduvia",
    });
    expect(loaded.r2).toMatchObject({
      bucket: "eduvia-stage",
      bucketName: "eduvia-stage",
      endpoint: "https://account.r2.cloudflarestorage.com",
      publicBaseUrl: "",
    });
    expect(loaded.origins).toEqual([
      "https://stage.example.com",
      "https://preview.example.com",
    ]);
    expect(loaded.cookie).toEqual({ secure: true, sameSite: "none" });
    expect(loaded.trustProxy).toBe(1);
  });

  test("staging with a complete environment loads", () => {
    const result = loadConfig({ NODE_ENV: "staging", ...COMPLETE_STAGE_ENV });
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/loaded/);
  });
});
