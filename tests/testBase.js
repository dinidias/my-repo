import session from "supertest-session";

// Set up test environment
process.env.NODE_ENV = "test";
process.env.JWT_PRIVATE_KEY = "testEnvironmentJwtSecretKey";

const createSuperTestSession = (app) => {
  return session(app);
};

function resetDatabase(_db) {
  return new Promise(async (resolve, reject) => {
    try {
      // For in-memory database, just run migrations and seeds
      // No need to drop tables since it's a fresh in-memory instance
      await _db.migrate.latest();
      await _db.seed.run();
      resolve();
    } catch (err) {
      console.error("Database reset error:", err);
      reject(err);
    }
  });
}

export default {
  createSuperTestSession,
  resetDatabase,
};
