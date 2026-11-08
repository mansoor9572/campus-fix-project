import { spawn } from "node:child_process"
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "tests/fixtures/location", "--hostname", "127.0.0.1", "--port", "3101"], {
  stdio: "inherit", env: { ...process.env, NODE_ENV: "development" },
})
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
child.on("exit", code => { process.exitCode = code ?? 1 })
