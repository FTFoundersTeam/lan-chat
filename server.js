const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const LOG_FILE = "chat.log";

// Load messages from previous sessions
let messages = [];
if (fs.existsSync(LOG_FILE)) {
  messages = fs.readFileSync(LOG_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

// Helper to log messages to file
function logMessage(msg) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(msg) + "\n");
}

// Create server
const server = http.createServer((req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // --- API: get messages ---
  if (req.url === "/api/messages" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(messages));
  }

  // --- API: send message ---
  if (req.url === "/api/send" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const msg = {
          ip,
          text: data.text,
          time: new Date().toISOString()
        };
        messages.push(msg);
        if (messages.length > 100) messages.shift(); // keep last 100
        logMessage(msg);

        res.writeHead(200);
        res.end("ok");
      } catch {
        res.writeHead(400);
        res.end("bad request");
      }
    });
    return;
  }
// Get users list
if (req.url === "/api/users" && req.method === "GET") {
  const now = Date.now();
  const online = new Set();
  const offline = new Set();

  messages.forEach(msg => {
    const lastSeen = new Date(msg.time).getTime();
    if (now - lastSeen < 600000) { // online if active in last 60 sec
      online.add(msg.ip);
    } else {
      offline.add(msg.ip);
    }
  });

  // remove online IPs from offline
  online.forEach(ip => offline.delete(ip));

  res.writeHead(200, { "Content-Type": "application/json" });
  return res.end(JSON.stringify({
    online: Array.from(online),
    offline: Array.from(offline)
  }));
}
  // --- ignore favicon ---
  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }

  // --- serve static files ---
  let filePath = path.join(PUBLIC_DIR, req.url === "/" ? "index.html" : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Persistent LAN chat running on http://<your-LAN-IP>:${PORT}`);
});
