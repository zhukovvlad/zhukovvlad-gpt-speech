import { MongoClient } from "mongodb";

// Client is now scoped at the module level instead of globally
let client;

/**
 * Connects to MongoDB.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function connect() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  }
}

/**
 * Disconnects from MongoDB.
 *
 * @async
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (client) {
    await client.close();
    console.log("Disconnected from MongoDB successfully");
  }
}

/**
 * Finds a user by ID or creates a new user if none exist.
 *
 * @async
 * @param {Object} userData - The user data.
 * @param {string} userData.id - The user id.
 * @returns {Promise<Object>} The user document.
 */
export async function findOrCreateUser(userData) {
  try {
    const db = client.db("Telegram"); // Accessing Telegram database
    const collection = db.collection("Users"); // Accessing Users collection

    // Try to find the user with the provided id
    let user = await collection.findOne({ id: userData.id });

    // If the user doesn't exist, create the user
    if (!user) {
      const result = await collection.insertOne(userData);
      //   console.log(result);
      user = await collection.findOne({ id: userData.id });
    }

    // console.log(user);
    return user;
  } catch (error) {
    console.error("Error finding or creating user:", error);
  }
}

/**
 * Adds or updates an array field for a user.
 *
 * @async
 * @param {string} userId - The user id.
 * @param {string} arrayFieldName - The array field name.
 * @param {Object} newArrayObject - The new array object.
 * @returns {Promise<Object>} The updated user document.
 */
export async function addOrUpdateArrayField(
  userId,
  arrayFieldName,
  newArrayObject
) {
  try {
    const db = client.db("Telegram"); // Accessing Telegram database
    const collection = db.collection("Users"); // Accessing Users collection
    const user = await collection.findOne({ id: userId });

    // If the array field doesn't exist, create it with the initial object
    if (!user || !user[arrayFieldName]) {
      await collection.updateOne(
        { id: userId },
        { $set: { [arrayFieldName]: [newArrayObject] } }
      );
    } else {
      // If the array field exists, append the new object to the array
      await collection.updateOne(
        { id: userId },
        { $push: { [arrayFieldName]: newArrayObject } }
      );
    }

    // Return the updated user
    return await collection.findOne({ id: userId });
  } catch (error) {
    console.error("Error updating array field:", error.message);
  }
}
