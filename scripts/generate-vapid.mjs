// Prints a new VAPID key pair for Web Push. Put both values in Vercel; never commit the private key.
import { createECDH } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString("base64url")}`);
