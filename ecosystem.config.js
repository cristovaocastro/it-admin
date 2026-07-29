module.exports = {
  apps: [{
    name: "it-admin",
    script: "npx",
    args: "next start -H 127.0.0.1 -p 3500",
    cwd: "/opt/it-admin",
    env: { NODE_ENV: "production" },
  }],
};
