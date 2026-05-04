import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET!
  return crypto.createHash('sha256').update(secret).digest()
}

// Hash wallet address exactly like password — for lookup/comparison
export async function hashWalletAddress(address: string): Promise<string> {
  return bcrypt.hash(address.toLowerCase(), 10)
}

export async function verifyWalletAddress(
  address: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(address.toLowerCase(), hash)
}

// Encrypt wallet address so we can display it back to user
export function encryptWalletAddress(address: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(address.toLowerCase(), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

export function decryptWalletAddress(encrypted: string): string {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  )
}
