import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { apiKeys, db, deployments } from "@cms/db";
import { decryptApiKey } from "./crypto.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const localProcesses = new Map<string, ChildProcess>();
let recoveringLocalDeployments = false;

class DeploymentConfigurationError extends Error {}

async function reserveAvailablePort(start: number, maximum = start + 1000): Promise<number> {
  for (let port = start; port < maximum; port += 1) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No free local website port was found between ${start} and ${maximum - 1}`);
}

function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, onOutput: (chunk: string) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let outputError: unknown;
    let pendingOutput = Promise.resolve();
    const queueOutput = (chunk: Buffer) => {
      const text = chunk.toString("utf8").trimEnd();
      if (!text) return;
      pendingOutput = pendingOutput.then(() => onOutput(text)).catch((error) => { outputError = error; });
    };
    child.stdout?.on("data", queueOutput);
    child.stderr?.on("data", queueOutput);
    child.once("error", (error) => reject(error));
    child.once("close", (code, signal) => {
      void pendingOutput.then(() => {
        if (outputError) return reject(outputError);
        if (code === 0) return resolve();
        reject(new Error(`${command} ${args.join(" ")} failed (${signal ?? code ?? "unknown exit"})`));
      });
    });
  });
}

async function waitForHealthy(url: string, child?: ChildProcess, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "not responding";
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error(`Website process exited before health check (code ${child.exitCode ?? child.signalCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Website did not pass its health check at ${url}: ${lastError}`);
}

function startNextServer(deploymentId: string, outDir: string, port: number): ChildProcess {
  const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(packageManager, ["run", "start"], {
    cwd: outDir,
    env: { ...process.env, PORT: String(port), HOSTNAME: "0.0.0.0" },
    windowsHide: true,
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  localProcesses.set(deploymentId, child);
  child.once("exit", (code, signal) => {
    localProcesses.delete(deploymentId);
    const message = `Local website process exited (${signal ?? code ?? "unknown"})`;
    void db.select({ logs: deployments.logs }).from(deployments)
      .where(and(eq(deployments.id, deploymentId), eq(deployments.status, "READY"))).limit(1)
      .then(async ([current]) => {
        if (!current) return;
        await db.update(deployments).set({
          status: "FAILED",
          errorMessage: message,
          finishedAt: new Date(),
          logs: `${current.logs}\n[${new Date().toISOString()}] ${message}`,
        }).where(and(eq(deployments.id, deploymentId), eq(deployments.status, "READY")));
      })
      .catch((error) => console.error(JSON.stringify({ level: "error", event: "deployment.process_exit", deploymentId, error: error instanceof Error ? error.message : String(error) })));
  });
  return child;
}

/** Make an existing immutable deployment healthy before changing the active version. */
export async function ensureDeploymentHealthy(
  deploymentId: string,
  siteSlug: string,
  target: string,
  liveUrl: string,
  outputPath: string,
): Promise<void> {
  const parsed = new URL(liveUrl);
  if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("Rollback only supports verified local deployment URLs");
  }
  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The saved deployment URL has an invalid port");
  const checkUrl = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(checkUrl, { signal: AbortSignal.timeout(2500) });
    if (response.ok) return;
  } catch {
    // Restore the saved local process or container below.
  }

  if (target === "local") {
    const child = startNextServer(deploymentId, outputPath, port);
    await waitForHealthy(checkUrl, child);
    return;
  }
  if (target !== "docker") throw new Error(`Rollback is not implemented for the ${target} provider`);

  const token = deploymentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
  const container = `cms-${siteSlug}-${token}`;
  const image = `cms-${siteSlug}:${token}`;
  const envFile = path.join(outputPath, ".env.local");
  const env = process.env;
  const quiet = () => Promise.resolve();
  try {
    await runCommand("docker", ["start", container], outputPath, env, quiet);
  } catch {
    await runCommand("docker", ["run", "--detach", "--restart", "unless-stopped", "--name", container,
      "--publish", `127.0.0.1:${port}:3000`, "--env-file", envFile, "--env", "PORT=3000", "--env", "HOSTNAME=0.0.0.0", image], outputPath, env, quiet);
  }
  try {
    await waitForHealthy(checkUrl);
  } catch (error) {
    await runCommand("docker", ["rm", "--force", container], outputPath, env, quiet).catch(() => undefined);
    throw error;
  }
}

export async function recoverLocalDeployments(): Promise<void> {
  if (recoveringLocalDeployments) return;
  recoveringLocalDeployments = true;
  try {
    const rows = await db.select({ id: deployments.id, outputPath: deployments.outputPath, liveUrl: deployments.liveUrl, status: deployments.status })
      .from(deployments).where(and(
        eq(deployments.target, "local"),
        inArray(deployments.status, ["READY", "FAILED"]),
        isNotNull(deployments.outputPath),
        isNotNull(deployments.liveUrl),
      ));
    for (const deployment of rows) {
      if (!deployment.outputPath || !deployment.liveUrl) continue;
      let port: number;
      try {
        port = Number(new URL(deployment.liveUrl).port);
      } catch {
        continue;
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
      try {
        const response = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          if (deployment.status === "FAILED") {
            const [current] = await db.select({ logs: deployments.logs }).from(deployments).where(eq(deployments.id, deployment.id)).limit(1);
            await db.update(deployments).set({
              status: "READY", errorMessage: null, finishedAt: null,
              logs: `${current?.logs ?? ""}\n[${new Date().toISOString()}] Local website health recovered at ${deployment.liveUrl}`,
            }).where(and(eq(deployments.id, deployment.id), eq(deployments.status, "FAILED")));
          }
          continue;
        }
      } catch {
        // Start or restart the generated site below.
      }
      const child = startNextServer(deployment.id, deployment.outputPath, port);
      try {
        await waitForHealthy(`http://127.0.0.1:${port}`, child);
        const [current] = await db.select({ logs: deployments.logs }).from(deployments).where(eq(deployments.id, deployment.id)).limit(1);
        await db.update(deployments).set({ status: "READY", errorMessage: null, finishedAt: null,
          logs: `${current?.logs ?? ""}\n[${new Date().toISOString()}] Local website restored and health-checked at ${deployment.liveUrl}`,
        }).where(and(eq(deployments.id, deployment.id), inArray(deployments.status, ["READY", "FAILED"])));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.update(deployments).set({ status: "FAILED", errorMessage: message, finishedAt: new Date() })
          .where(and(eq(deployments.id, deployment.id), inArray(deployments.status, ["READY", "FAILED"])));
        if (child.exitCode === null) child.kill();
      }
    }
  } finally {
    recoveringLocalDeployments = false;
  }
}

/** Run a deployment request from the durable outbox queue. */
export async function runDeploymentJob(deploymentId: string, siteSlug: string, target: string): Promise<void> {
  const appendLog = async (line: string, status?: string, extra?: Partial<typeof deployments.$inferInsert>) => {
    const [current] = await db
      .select({ logs: deployments.logs, status: deployments.status })
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);
    if (!current || ["CANCELLED", "READY", "FAILED"].includes(current.status)) return false;
    const nextLogs = [current.logs, `[${new Date().toISOString()}] ${line}`].filter(Boolean).join("\n");
    const [updated] = await db.update(deployments).set({ logs: nextLogs, ...(status ? { status } : {}), ...extra })
      .where(and(eq(deployments.id, deploymentId), eq(deployments.status, current.status)))
      .returning({ id: deployments.id });
    return Boolean(updated);
  };

  const started = await appendLog(`Starting ${target} deployment for site "${siteSlug}"...`, "BUILDING");
  if (!started) return;

  if (target === "vercel") {
    const configuration = "Vercel deployment is not configured. Add a deployment integration with a Vercel token, project, and health check before retrying.";
    await appendLog(configuration, "FAILED", { errorMessage: configuration, finishedAt: new Date() });
    return;
  }

  try {
    const [deploymentRow] = await db.select({ siteId: deployments.siteId }).from(deployments)
      .where(eq(deployments.id, deploymentId)).limit(1);
    if (!deploymentRow) return;
    const [keyRecord] = await db.select({ encryptedKey: apiKeys.encryptedKey }).from(apiKeys)
      .where(and(eq(apiKeys.siteId, deploymentRow.siteId), eq(apiKeys.type, "read"), isNull(apiKeys.revokedAt)))
      .limit(1);
    if (!keyRecord?.encryptedKey) {
      throw new DeploymentConfigurationError("This site has no server-managed encrypted read key. Rotate its read API key, then retry the deployment.");
    }
    const pepper = process.env.API_KEY_PEPPER ?? "";
    const readKey = decryptApiKey(keyRecord.encryptedKey, pepper);
    const apiBaseUrl = process.env.API_PUBLIC_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000";
    const revalidateSecret = process.env.REVALIDATE_SECRET ?? "";
    if (revalidateSecret.length < 32) {
      throw new DeploymentConfigurationError("REVALIDATE_SECRET must be configured with at least 32 characters before deploying a generated website.");
    }

    const generatorCli = path.join(repoRoot, "apps", "generator", "dist", "cli.js");
    await fs.access(generatorCli).catch(() => {
      throw new DeploymentConfigurationError("The site generator build is missing. Run the monorepo build before retrying this deployment.");
    });
    const outDir = path.join(repoRoot, "generated", siteSlug, "deployments", deploymentId);
    const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const commandEnv = { ...process.env, GENERATOR_READ_KEY: readKey, REVALIDATE_SECRET: revalidateSecret };
    const logCommand = (label: string) => async (line: string) => { await appendLog(`${label}: ${line}`); };

    await appendLog(`Generating the Next.js site into ${outDir}`);
    await runCommand(process.execPath, [generatorCli, `--site=${siteSlug}`, `--api-url=${apiBaseUrl}`, `--output-dir=${outDir}`], repoRoot, commandEnv, logCommand("generate"));

    const preferredPort = Number(process.env.LOCAL_DEPLOYMENT_PORT_START ?? 3100);
    if (!Number.isInteger(preferredPort) || preferredPort < 1024 || preferredPort > 64000) {
      throw new DeploymentConfigurationError("LOCAL_DEPLOYMENT_PORT_START must be an available port between 1024 and 64000.");
    }
    const port = await reserveAvailablePort(preferredPort);
    const liveUrl = `http://localhost:${port}`;
    if (target === "docker") {
      try {
        await runCommand("docker", ["info"], outDir, commandEnv, () => Promise.resolve());
      } catch {
        throw new DeploymentConfigurationError("Docker is not available to the API process. Start Docker Desktop or configure a Docker daemon, then retry.");
      }
      const deploymentToken = deploymentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
      const image = `cms-${siteSlug}:${deploymentToken}`;
      const container = `cms-${siteSlug}-${deploymentToken}`;
      const envFile = path.join(outDir, ".env.local");
      await appendLog(`Building Docker image ${image}`);
      await runCommand("docker", ["build", "--secret", `id=cms_env,src=${envFile}`, "--tag", image, "."], outDir, commandEnv, logCommand("docker build"));
      try {
        // A worker may be retried after starting the container but before it
        // commits READY. Remove that deployment's prior attempt first.
        await runCommand("docker", ["rm", "--force", container], outDir, commandEnv, () => Promise.resolve()).catch(() => undefined);
        await runCommand("docker", ["run", "--detach", "--restart", "unless-stopped", "--name", container,
          "--publish", `127.0.0.1:${port}:3000`, "--env-file", envFile, "--env", "PORT=3000", "--env", "HOSTNAME=0.0.0.0", image],
        outDir, commandEnv, logCommand("docker run"));
        await waitForHealthy(`http://127.0.0.1:${port}`);
      } catch (error) {
        await runCommand("docker", ["rm", "--force", container], outDir, commandEnv, () => Promise.resolve()).catch(() => undefined);
        throw error;
      }
    } else {
      await runCommand(packageManager, ["install", "--ignore-workspace"], outDir, commandEnv, logCommand("install"));
      await runCommand(packageManager, ["run", "build"], outDir, commandEnv, logCommand("build"));
      const child = startNextServer(deploymentId, outDir, port);
      await waitForHealthy(`http://127.0.0.1:${port}`, child);
    }
    await appendLog(`Built and health-checked website is serving at ${liveUrl}`, "READY", {
      liveUrl,
      outputPath: outDir,
      errorMessage: null,
      finishedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof DeploymentConfigurationError) {
      await appendLog(message, "FAILED", { errorMessage: message, finishedAt: new Date() });
      return;
    }
    const child = localProcesses.get(deploymentId);
    if (child && child.exitCode === null) child.kill();
    localProcesses.delete(deploymentId);
    throw error;
  }
}
