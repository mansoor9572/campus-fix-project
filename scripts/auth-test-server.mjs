import { spawn } from "node:child_process"

// Local test server only. Explicit environment affects this child, never .env.local.
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development", AUTH_TEST_SERVER: "1", APP_URL: "http://127.0.0.1:3100", AUTH_URL: "http://127.0.0.1:3100", AUTH_EMAIL_PROVIDER: "file" },
})
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
child.on("exit", code => { process.exitCode = code ?? 1 })
