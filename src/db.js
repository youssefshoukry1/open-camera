import { openDB } from 'idb';

const DB_NAME = 'photo-booth-db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

// Initialize the database
const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  },
});

/**
 * Get all photos from the database, sorted newest first.
 * @returns {Promise<Array>} A promise that resolves to an array of photos.
 */
export async function getAllPhotos() {
  const db = await dbPromise;
  // Get all and then reverse in JS to sort by newest, since IndexedDB cursors are complex.
  const photos = await db.getAll(STORE_NAME);
  return photos.reverse();
}

/**
 * Add a new photo to the database.
 * @param {object} photo - The photo object to add, containing the original dataURL.
 * @returns {Promise<number>} A promise that resolves to the new photo's ID.
 */
export async function addPhoto(photo) {
  const db = await dbPromise;
  return db.add(STORE_NAME, photo);
}

/**
 * Delete a photo from the database by its ID.
 * @param {number} id - The ID of the photo to delete.
 * @returns {Promise<void>}
 */
export async function deletePhoto(id) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, id);
}

/**
 * Delete all photos from the database.
 * @returns {Promise<void>}
 */
export async function deleteAllPhotos() {
  const db = await dbPromise;
  return db.clear(STORE_NAME);
}
