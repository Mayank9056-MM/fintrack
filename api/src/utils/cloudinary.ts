import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import { Readable } from "stream";
import { config } from "../config/config";

// configure cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

// Helpers

/**
 * Uploads a Buffer to Cloudinary.
 *
 * @param {Buffer} buffer - The Buffer to upload to Cloudinary.
 * @param {Record<string, unknown>} [options] - Optional cloudinary upload options.
 * @returns {Promise<UploadApiResponse>} - A promise that resolves to the Cloudinary response if the upload is successful, or null if an error occurs.
 */
const uploadBufferToCloudinary = (
  buffer: Buffer,
  options: Record<string, unknown> = {}
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", ...options },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("No response from Cloudinary"));
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

// main

/**
 * Uploads a file or buffer to Cloudinary.
 *
 * If a Buffer is supplied, it will be uploaded directly to Cloudinary.
 * If a string is supplied, it is assumed to be a local file path and the file will be read from disk and uploaded to Cloudinary.
 *
 * Returns a promise that resolves to the Cloudinary response if the upload is successful, or null if an error occurs.
 * If an error occurs and a local file path was supplied, the file will be cleaned up from the local disk.
 *
 * @param {Buffer | string} input - The file or buffer to upload to Cloudinary.
 * @param {Record<string, unknown>} [options] - Optional cloudinary upload options.
 * @returns {Promise<UploadApiResponse | null>}
 */
const uploadOnCloudinary = async (
  input: Buffer | string,
  options: Record<string, unknown> = {}
): Promise<UploadApiResponse | null> => {
  try {
    if (!input) return null;

    if (Buffer.isBuffer(input)) {
      return await uploadBufferToCloudinary(input, options);
    }

    const response = await cloudinary.uploader.upload(input, {
      resource_type: "auto",
      ...options,
    });

    if (fs.existsSync(input)) {
      fs.unlinkSync(input);
    }

    return response;
  } catch (error) {
    // Clean up local file on error if a path was supplied
    if (typeof input === "string" && fs.existsSync(input)) {
      fs.unlinkSync(input);
    }

    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
};

/**
 * Deletes a file from Cloudinary based on its public ID.
 * If the file doesn't exist, nothing happens.
 * If an error occurs, it is logged to the console.
 * @param {string} publicId - The public ID of the Cloudinary file to delete.
 * @returns {Promise<void>} - A promise that resolves when the file has been deleted.
 */
const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
