import mongoose from "mongoose";
import { config } from "../config/config";
import logger from "../utils/logger";
import { DB_NAME, MAX_RETRIES, RETRY_INTERVAL } from "../utils/constants";

class DatabaseConnection {
  private retryCount: number;
  private isConnected: boolean;

  constructor() {
    this.retryCount = 0;
    this.isConnected = false;

    // configure mongoose settings
    mongoose.set("strictQuery", true);

    mongoose.connection.on("connected", () => {
      logger.info("\nMONGODB CONNECTED SUCCESSFULLY\n");
      this.isConnected = true;
    });

    mongoose.connection.on("error", () => {
      logger.info("MONGODB CONNECTION ERROR");
      this.isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      logger.info("MONGODB DISCONNECTED");
      this.isConnected = false;
      // this.handleDisconnection();
    });

    process.on("SIGTERM", this.handleAppTermination.bind(this));
  }

  async connectDB() {
    try {
      if (!config.MONGODB_URI) {
        throw new Error("MONGO db URI is not found in evn variables");
      }

      const connectionOptions = {
        maxPoolSize: 10, // how many threads connect to database free plan it's 10
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // use IPv4
      };

      if (config.NODE_ENV === "development") {
        mongoose.set("debug", true);
      }

      await mongoose.connect(
        `${config.MONGODB_URI}/${DB_NAME}`,
        connectionOptions
      );
      this.retryCount = 0; // reset retry count on success
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      } else {
        logger.error("Unknown error occurred");
      }
      await this.handleConnectionError();
    }
  }

  async handleConnectionError() {
    if (this.retryCount < MAX_RETRIES) {
      this.retryCount++;
      logger.info(
        `Retrying connection... Attempt ${this.retryCount} of ${MAX_RETRIES}`
      );

      await new Promise(
        (
          resolve // waiting 5 sec here !
        ) => setTimeout(resolve, RETRY_INTERVAL)
      );
      return this.connectDB();
    } else {
      logger.error(
        `Failed to connect to MONGODB after ${MAX_RETRIES} attempts`
      );
      process.exit(1);
    }
  }

  async handleDisconnection() {
    if (!this.isConnected) {
      logger.info("Attempting to reconnected to mongodb...");
      this.connectDB();
    }
  }

  async handleAppTermination() {
    try {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed through app termination");
      process.exit(0);
    } catch (error) {
      logger.error("Error during database disconnection", error);
      process.exit(1);
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }
}

// create a singleton instance
const dbConnection = new DatabaseConnection();

export default dbConnection.connectDB.bind(dbConnection);
export const getDBStatus = dbConnection.getConnectionStatus.bind(dbConnection);
