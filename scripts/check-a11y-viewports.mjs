/**
 * Keyboard, 320/390 overflow, and the Chrome accessibility tree.
 * This is not a VoiceOver or TalkBack pass.
 */
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const shellSource = readFileSync(new URL("../components/auth-shell.tsx", import.meta.url), "utf8");
const formAt = shellSource.indexOf('id="auth-form"');
const formTarget = shellSource.slice(formAt, formAt + 80);
if (formAt < 0 || !formTarget.includes("tabIndex={-1}")) {
  throw new Error("Auth skip target #auth-form is not programmatically focusable");
}

const base = process.env.WEERSPORT_BASE_URL;
if (!base) {
  console.log("a11y viewport checks skipped (no WEERSPORT_BASE_URL)");
  process.exit(0);
}

const port = 9333;
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--remote-debugging-port=" + port,
    `--user-data-dir=/tmp/weersport-a11y-${process.pid}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let ws;
try {
  let version;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
      break;
    } catch {
      await delay(200);
    }
  }
  if (!version?.webSocketDebuggerUrl) throw new Error("Chrome DevTools did not start");
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 8000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const created = await send("Target.createTarget", { url: "about:blank" });
  const attached = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Accessibility.enable", {}, sessionId);

  async function open(url, width) {
    await send(
      "Emulation.setDeviceMetricsOverride",
      { width, height: 800, deviceScaleFactor: 1, mobile: width < 500 },
      sessionId,
    );
    await send("Page.navigate", { url }, sessionId);
    await delay(700);
  }

  async function evaluate(expression) {
    const result = await send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  }

  const pages = ["/", "/support", "/support/terugbetaling", "/privacy?van=/auth/registreren", "/auth/registreren"];
  for (const width of [320, 390]) {
    for (const path of pages) {
      await open(new URL(path, base).toString(), width);
      const overflow = await evaluate(`(() => {
        const before = window.scrollX;
        window.scrollTo(200, 0);
        const moved = window.scrollX;
        window.scrollTo(before, 0);
        const clipped = [...document.querySelectorAll("h1, h2, h3, p, a, button, input, label")]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return false;
            return rect.left < -1 || rect.right > window.innerWidth + 1;
          })
          .slice(0, 6)
          .map((element) => element.tagName + "." + String(element.className).slice(0, 60));
        return { moved, clipped };
      })()`);
      if (overflow.moved !== 0 || overflow.clipped.length) {
        throw new Error(`${path} at ${width}px scrolls ${overflow.moved} or clips ${JSON.stringify(overflow.clipped)}`);
      }
    }
  }

  await open(new URL("/support", base).toString(), 390);
  const tree = await send("Accessibility.getFullAXTree", {}, sessionId);
  const names = tree.nodes
    .filter((node) => ["heading", "link", "button"].includes(node.role?.value))
    .map((node) => `${node.role.value}:${node.name?.value || ""}`);
  if (!names.some((name) => name.startsWith("heading:Support"))) throw new Error("Support heading missing from a11y tree");
  if (!names.some((name) => name.includes("Terugbetalingen"))) throw new Error("Refund link missing from a11y tree");
  if (!names.some((name) => name.includes("Naar inhoud"))) throw new Error("Skip link missing from a11y tree");

  await open(new URL("/", base).toString(), 390);
  const homeKeys = await evaluate(`(() => {
    const skip = document.querySelector(".skip-link");
    skip.focus();
    return document.activeElement?.textContent?.trim() || "";
  })()`);
  if (homeKeys !== "Naar inhoud") throw new Error(`Homepage skip link was not focused (${homeKeys})`);

  await open(new URL("/auth/registreren", base).toString(), 390);
  const keyboard = await evaluate(`(() => {
    const skip = document.querySelector(".skip-link");
    skip.focus();
    const first = document.activeElement?.textContent?.trim() || "";
    const focusable = [...document.querySelectorAll("a, button, input, select, textarea")].filter((element) => element.tabIndex >= 0);
    const unnamed = focusable.filter((element) => {
      const labelled = element.labels?.length || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby");
      const text = (element.innerText || element.getAttribute("value") || "").trim();
      return !labelled && !text;
    }).map((element) => element.outerHTML.slice(0, 120));
    return { first, count: focusable.length, unnamed };
  })()`);
  if (keyboard.first !== "Naar formulier") throw new Error(`Registration skip link was not focused (${keyboard.first})`);
  if (keyboard.unnamed.length) throw new Error(`Unnamed controls: ${keyboard.unnamed.join(" | ")}`);
  if (keyboard.count < 5) throw new Error("Registration form exposed too few keyboard controls");

  await send("Target.activateTarget", { targetId: created.targetId });
  const afterSkip = await evaluate(`(() => {
    const skip = document.querySelector(".skip-link");
    skip.focus();
    skip.click();
    const active = document.activeElement;
    const form = document.getElementById("auth-form");
    return {
      id: active?.id || "",
      onForm: active === form,
      wordmark: active?.classList?.contains("auth-wordmark") || false,
    };
  })()`);
  if (!afterSkip.onForm || afterSkip.wordmark) {
    throw new Error(`Skip link left focus outside the form (${JSON.stringify(afterSkip)})`);
  }
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  }, sessionId);
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
  }, sessionId);
  const afterTab = await evaluate(`(() => {
    const active = document.activeElement;
    const form = document.getElementById("auth-form");
    return {
      id: active?.id || "",
      tag: active?.tagName || "",
      inside: Boolean(form && active && form.contains(active) && active !== form),
      wordmark: active?.classList?.contains("auth-wordmark") || false,
    };
  })()`);
  if (!afterTab.inside || afterTab.wordmark || afterTab.id !== "naam") {
    throw new Error(`Tab after the skip link missed the first form control (${JSON.stringify(afterTab)})`);
  }

  console.log(`a11y viewports ok (${keyboard.count} focusable controls on registration)`);
} finally {
  chrome.kill("SIGKILL");
  ws?.close();
}
