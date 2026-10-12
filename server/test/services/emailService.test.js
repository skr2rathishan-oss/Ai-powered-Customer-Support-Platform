process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createTransporter,
  sendMail,
  sendPasswordResetEmail,
} = require("../../src/services/emailService");

const ENV_KEYS = [
  "MAIL_USER",
  "SMTP_USER",
  "MAIL_PASSWORD",
  "SMTP_PASS",
  "SMTP_HOST",
  "SMTP_PORT",
  "MAIL_FROM",
  "SMTP_FROM",
  "APP_NAME",
  "MAIL_LOCAL_ADDRESS",
  "SMTP_LOCAL_ADDRESS",
];

function withEnv(values, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, { MAIL_LOCAL_ADDRESS: "127.0.0.1", ...values });
  const restore = () => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
  try {
    const result = fn();
    return result && typeof result.then === "function" ? result.finally(restore) : (restore(), result);
  } catch (error) {
    restore();
    throw error;
  }
}

const capture = (options) => options;

test("settings override env for host, port and user; password is env-only", () => {
  withEnv(
    { MAIL_USER: "env@example.test", MAIL_PASSWORD: "env-secret", SMTP_HOST: "env.host", SMTP_PORT: "465" },
    () => {
      const options = createTransporter(
        { host: "smtp.settings.test", port: 2525, user: "set@example.test", requireTls: true, password: "ignored", pass: "ignored" },
        capture,
      );
      assert.equal(options.host, "smtp.settings.test");
      assert.equal(options.port, 2525);
      assert.equal(options.auth.user, "set@example.test");
      assert.equal(options.auth.pass, "env-secret");
      assert.equal(options.secure, false);
      assert.equal(options.requireTLS, true);
    },
  );
});

test("env and built-in defaults apply when settings are empty", () => {
  withEnv({ MAIL_USER: "env@example.test", MAIL_PASSWORD: "pw", SMTP_HOST: "env.host", SMTP_PORT: "2526" }, () => {
    const options = createTransporter({}, capture);
    assert.equal(options.host, "env.host");
    assert.equal(options.port, 2526);
    assert.equal(options.auth.user, "env@example.test");
  });

  withEnv({ MAIL_USER: "env@example.test", MAIL_PASSWORD: "pw" }, () => {
    const options = createTransporter(undefined, capture);
    assert.equal(options.host, "smtp.gmail.com");
    assert.equal(options.port, 587);
    assert.equal(options.requireTLS, true);
  });
});

test("port 465 uses implicit TLS and requireTls=false disables STARTTLS enforcement", () => {
  withEnv({ MAIL_USER: "u@example.test", MAIL_PASSWORD: "pw" }, () => {
    const implicit = createTransporter({ port: 465, requireTls: true }, capture);
    assert.equal(implicit.secure, true);
    assert.equal(implicit.requireTLS, false);

    const relaxed = createTransporter({ port: 587, requireTls: false }, capture);
    assert.equal(relaxed.secure, false);
    assert.equal(relaxed.requireTLS, false);
  });
});

test("missing credentials throw", () => {
  withEnv({}, () => {
    assert.throws(() => createTransporter({ user: "u@example.test" }, capture), /Missing SMTP credentials/);
  });
});

test("sendMail and reset email build the From header from sanitized settings", async () => {
  const nodemailer = require("nodemailer");
  const original = nodemailer.createTransport;
  const sent = [];
  nodemailer.createTransport = (options) => ({
    options,
    sendMail: async (message) => {
      sent.push({ options, message });
      return { messageId: "m1" };
    },
  });

  try {
    await withEnv({ MAIL_USER: "env@example.test", MAIL_PASSWORD: "pw" }, async () => {
      const smtp = { host: "smtp.settings.test", port: 2525, user: "set@example.test", senderName: 'Acme "Desk" <x>' };
      const info = await sendMail({ to: "to@example.test", subject: "S", text: "T", html: "<p>T</p>", smtp });
      assert.equal(info.messageId, "m1");
      assert.equal(sent[0].options.host, "smtp.settings.test");
      assert.equal(sent[0].message.from, '"Acme Desk x" <set@example.test>');

      await sendPasswordResetEmail("to@example.test", "http://x/reset?token=1", smtp);
      assert.equal(sent[1].message.from, '"Acme Desk x" <set@example.test>');
      assert.match(sent[1].message.subject, /Acme Desk x/);
    });
  } finally {
    nodemailer.createTransport = original;
  }
});
