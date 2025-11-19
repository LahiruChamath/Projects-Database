import { jwtVerify, SignJWT } from "jose";

const key = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

export async function signSession(payload, exp = "7d") {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}
