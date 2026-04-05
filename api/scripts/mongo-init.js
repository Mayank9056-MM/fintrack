const dbName = process.env.MONGO_INITDB_DATABASE || "fintrack";
const appUser = process.env.MONGO_APP_USER || "fintrack_user";
const appPass = process.env.MONGO_APP_PASSWORD || "fintrack_pass";

db = db.getSiblingDB(dbName);

db.createUser({
    user: appUser,
    pwd: appPass,
    roles: [
        {
            role: "readWrite",
            db: dbName,
        },
    ],
});

print(`✅ MongoDB: created user "${appUser}" with readWrite on "${dbName}"`);