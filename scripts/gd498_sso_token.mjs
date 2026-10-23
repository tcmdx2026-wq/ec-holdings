import { SignJWT } from "jose";
import { readFileSync, writeFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf-8");
const secret = env.match(/^APP_JWT_SECRET=(.*)$/m)[1].trim();
const me = JSON.parse(readFileSync("scripts/gd498_me.json", "utf-8"));
const payload = {
  empId: me.user.empId, name: me.user.name, email: "cuongpk.giong04@gmail.com",
  role: me.user.role, center: me.user.center ?? "VP", mods: me.user.mods,
};
const token = await new SignJWT(payload)
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt().setExpirationTime("120s")
  .setIssuer("giong-vn-v6").setAudience("giong-banhang")
  .setSubject(me.user.empId)
  .sign(new TextEncoder().encode(secret));
writeFileSync("scripts/gd498_sso_token.txt", token);
console.log("token dài:", token.length);
