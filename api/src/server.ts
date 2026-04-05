import "dotenv/config";
import { config } from "./config/config";
import { app } from "./app";
import logger from "./utils/logger";
import connectDB, { getDBStatus } from "./db";
import { EmailService } from "./services/emailService";

const PORT = config.PORT;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Give some time for ongoing requests to complete
  setTimeout(() => {
    logger.info("Graceful shutdown completed");
    process.exit(0);
  }, 5000);
};

// Process event handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, async () => {
  try {
    await connectDB();
    // await connectRedis();

    // Initialize email service
    EmailService.initialize();

    const server = app.listen(PORT, () => {
      logger.info(
        `🚀 Server is running on port ${PORT} in ${config.NODE_ENV} mode`
      );

      logger.info("📦 Database connection:", getDBStatus());
    });

    logger.info("📊 Available endpoints:");
    logger.info(`   Health check: http://localhost:${PORT}/health`);
    logger.info(`   API Base: http://localhost:${PORT}/api`);
    logger.info(`   Database: ${config.MONGODB_URI.split("@")[1]}`);
    logger.info(
      `   Email Service: ${config.SMTP_HOST ? "Enabled" : "Disabled"}`
    );
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
});
