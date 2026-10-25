"use strict";

const http = require("http");

/**
 * Sends one request to the Express app on an ephemeral port and returns
 * `{ status, body, headers }`. `cookie` is sent as the Cookie header.
 */
function request(app, { method = "GET", path, token, body, cookie, headers: extra = {} }) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          port: server.address().port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
            ...extra,
            ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString();
            resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {}, headers: res.headers });
          });
        },
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

/** Like `request` but resolves the raw body as a Buffer (file downloads). */
function requestRaw(app, { method = "GET", path, token }) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request(
        { port: server.address().port, path, method, headers: token ? { Authorization: `Bearer ${token}` } : {} },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers });
          });
        },
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

module.exports = { request, requestRaw };
