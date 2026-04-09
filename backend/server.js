const app = require("./app");
const { getPool, closePool } = require("./config/db");
const { ensureDefaultAdmin } = require("./services/bootstrapService");

const PORT = Number(process.env.PORT || 8080);

async function startServer() {
  try {
    await getPool();
    try {
      const createdAdmin = await ensureDefaultAdmin();
      if (createdAdmin) {
        console.log("Default admin account created successfully.");
      }
    } catch (bootstrapError) {
      console.error("Admin bootstrap warning:", bootstrapError.message || bootstrapError);
    }

    const server = app.listen(PORT, () => {
      console.log(`Oracle backend running on port ${PORT}`);
    });

    const shutdown = async () => {
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
