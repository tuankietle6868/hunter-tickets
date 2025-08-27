/* global WebSocket, console, fetch, process, setTimeout */

const debugPort = process.env.CHROME_DEBUG_PORT ?? "9225";
const formUrl = "http://127.0.0.1:4173/manual-test/generic-form.html";

function sendCommand(debuggerUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(debuggerUrl);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id: 1, method, params }));
    });
    socket.addEventListener("message", (event) => {
      const response = JSON.parse(event.data);
      socket.close();
      if (response.error) {
        reject(new Error(response.error.message));
      } else {
        resolve(response.result);
      }
    });
    socket.addEventListener("error", reject);
  });
}

const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) =>
  response.json(),
);
const extensionWorker = targets.find(
  (target) =>
    target.type === "service_worker" &&
    target.url.endsWith("/background/serviceWorker.js"),
);
const page = targets.find((target) => target.type === "page" && target.url === "about:blank");

if (!extensionWorker || !page) {
  throw new Error("Extension worker or blank browser page was not found.");
}

await sendCommand(extensionWorker.webSocketDebuggerUrl, "Runtime.evaluate", {
  expression: `new Promise((resolve) => chrome.storage.local.set({ profile: {
    fullName: "Nguyễn Văn An",
    phone: "0901234567",
    email: "an@example.com",
    address: "12 Nguyễn Huệ, Quận 1"
  } }, resolve))`,
  awaitPromise: true,
});
await sendCommand(page.webSocketDebuggerUrl, "Page.navigate", { url: formUrl });
await new Promise((resolve) => setTimeout(resolve, 500));
const result = await sendCommand(page.webSocketDebuggerUrl, "Runtime.evaluate", {
  expression: `JSON.stringify(Array.from(document.querySelectorAll("input, textarea"),
    ({ name, value }) => ({ name, value })))`,
  returnByValue: true,
});

console.log(result.result.value);
