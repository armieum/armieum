const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const JWT_EXPIRES_IN = "12h";

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, authRequired };
