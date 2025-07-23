import redis from "./index";

/**
 * Set a field in a Redis hash and expire the entire hash key at midnight.
 *
 * @param hashKey Redis hash key (e.g., "attendance")
 * @param field Field name in the hash (e.g., "semester-8")
 * @param value Value to set (can be stringified JSON)
 */
export const setHashWithMidnightExpiry = async (
  hashKey: string,
  field: string,
  value: string
) => {
  // Set the hash field
  await redis.hset(hashKey, field, value);

  // Check if key already has an expiry (to avoid resetting on every set)
  const ttl = await redis.ttl(hashKey);

  if (ttl === -1) {
    // No expiry set → calculate seconds till midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // 12:00 AM tomorrow

    const secondsUntilMidnight = Math.floor(
      (tomorrow.getTime() - now.getTime()) / 1000
    );

    // Set expiry
    await redis.expire(hashKey, secondsUntilMidnight);
  }
};

/**
 * Set a Redis string key and expire it at midnight.
 *
 * @param key Redis key (e.g., "payload")
 * @param value Value to set (can be string or stringified JSON)
 */
export const setKeyWithMidnightExpiry = async (key: string, value: string) => {
  // Calculate seconds till midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(now.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);

  const secondsUntilMidnight = Math.floor(
    (midnight.getTime() - now.getTime()) / 1000
  );

  // Set value with TTL
  await redis.set(key, value, "EX", secondsUntilMidnight);
};
