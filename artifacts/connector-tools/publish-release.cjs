const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const { parse } = require(path.join(root, 'backend/node_modules/dotenv'));
const { S3Client, PutObjectCommand, HeadObjectCommand } = require(path.join(root, 'backend/node_modules/@aws-sdk/client-s3'));
const config = parse(fs.readFileSync(path.join(root, 'backend/.env')));
const version = require(path.join(root, 'attendance-connector/package.json')).version;
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const assets = [
  { name: 'AttendanceConnectorSetup.exe', file: 'attendance-connector/installer/output/AttendanceConnectorSetup.exe' },
  { name: 'connector.exe', file: 'attendance-connector/release/connector.exe' },
].map((asset) => ({ ...asset, bytes: fs.readFileSync(path.join(root, asset.file)) }));
for (const asset of assets) {
  if (asset.bytes.subarray(0, 2).toString() !== 'MZ') throw new Error(`Invalid executable: ${asset.name}`);
}
const sums = assets.map((asset) => `${hash(asset.bytes)}  ${asset.name}`).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'SHA256SUMS.txt'), sums);
assets.push({ name: 'SHA256SUMS.txt', bytes: Buffer.from(sums) });
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
});
async function main() {
  for (const asset of assets) {
    for (const folder of [`v${version}/`, '']) {
      const key = `downloads/attendance-connector/${folder}${asset.name}`;
      await client.send(new PutObjectCommand({
        Bucket: config.R2_BUCKET, Key: key, Body: asset.bytes,
        ContentType: asset.name.endsWith('.exe') ? 'application/octet-stream' : 'text/plain',
        ContentDisposition: `attachment; filename="${asset.name}"`,
        CacheControl: folder ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      }));
      const stored = await client.send(new HeadObjectCommand({ Bucket: config.R2_BUCKET, Key: key }));
      if (stored.ContentLength !== asset.bytes.length) throw new Error(`Size mismatch: ${key}`);
      console.log(`Uploaded and checked: ${key} (${stored.ContentLength} bytes)`);
    }
  }
  const installer = assets[0];
  const url = `${config.R2_PUBLIC_URL.replace(/\/+$/, '')}/downloads/attendance-connector/${installer.name}`;
  const response = await fetch(`${url}?verify=${Date.now()}`);
  if (!response.ok) throw new Error(`Public download returned HTTP ${response.status}`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (hash(downloaded) !== hash(installer.bytes)) throw new Error('Public download checksum mismatch');
  console.log(JSON.stringify({ verifiedDownload: url, status: response.status, bytes: downloaded.length, sha256: hash(downloaded) }));
}
main().catch((error) => { console.error(error.name, error.message); process.exitCode = 1; });
