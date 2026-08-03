const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('crypto');
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const MAGIC = Buffer.from('UTMSENC1');
let client;

function encryptionKey() {
  const configured = process.env.UTMS_OBJECT_ENCRYPTION_KEY || process.env.CDE_SESSION_ENCRYPTION_KEY || '';
  if (process.env.NODE_ENV === 'production' && configured.length < 32) {
    throw new Error('UTMS_OBJECT_ENCRYPTION_KEY must contain at least 32 characters in production.');
  }
  return createHash('sha256').update(configured || 'utms-development-object-key').digest();
}

function encryptObject(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

function decryptObject(value) {
  const input = Buffer.from(value);
  if (!input.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Encrypted object header is invalid.');
  const iv = input.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = input.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(input.subarray(MAGIC.length + 28)), decipher.final()]);
}

function s3() {
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || 'utms-minio',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'utms-minio-development',
      },
    });
  }
  return client;
}

function bucket() {
  return process.env.S3_BUCKET || 'utms-private';
}

async function putEncryptedObject(key, value, contentType = 'application/octet-stream') {
  await s3().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: encryptObject(value),
    ContentType: 'application/octet-stream',
    Metadata: { encrypted: 'aes-256-gcm', originalContentType: contentType },
  }));
  return key;
}

async function getEncryptedObject(key) {
  const response = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return decryptObject(Buffer.from(await response.Body.transformToByteArray()));
}

async function deleteObject(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = {
  deleteObject,
  decryptObject,
  encryptObject,
  getEncryptedObject,
  putEncryptedObject,
};
