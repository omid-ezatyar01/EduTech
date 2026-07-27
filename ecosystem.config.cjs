const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "edutech-api",
      cwd: path.join(__dirname, "backend"),
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 3000,
      min_uptime: "10s",
      max_restarts: 10,
      max_memory_restart: "750M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
