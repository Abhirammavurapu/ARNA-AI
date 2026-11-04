import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

const COOKIE = 'arna_session';
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
const publicUser = (user) => ({ id: user._id.toString(), name: user.name, email: user.email });
function ensureReady() {
  if (mongoose.connection.readyState !== 1) throw new AppError('MongoDB is not connected. Set MONGODB_URI in server/.env and restart.', 503, 'DATABASE_UNAVAILABLE');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new AppError('Set JWT_SECRET (at least 32 characters) in server/.env.', 503, 'AUTH_NOT_CONFIGURED');
}
function issueSession(user, res) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d', issuer: 'arna-ai' });
  res.cookie(COOKIE, token, cookieOptions());
  return token;
}

export async function register(req, res, next) {
  try {
    ensureReady();
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (name.length < 2 || name.length > 60) throw new AppError('Name must be between 2 and 60 characters.', 400, 'VALIDATION_ERROR');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError('Enter a valid email address.', 400, 'VALIDATION_ERROR');
    if (password.length < 8 || password.length > 72) throw new AppError('Password must be between 8 and 72 characters.', 400, 'VALIDATION_ERROR');
    if (await User.exists({ email })) throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = issueSession(user, res);
    res.status(201).json({ success: true, user: publicUser(user), token });
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    ensureReady();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    const token = issueSession(user, res);
    res.json({ success: true, user: publicUser(user), token });
  } catch (err) { next(err); }
}

export async function me(req, res, next) {
  try {
    ensureReady();
    const user = await User.findById(req.user.id);
    if (!user) throw new AppError('Account not found. Please log in again.', 401, 'SESSION_EXPIRED');
    res.json({ success: true, user: publicUser(user) });
  } catch (err) { next(err); }
}

export function logout(_req, res) {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie(COOKIE, clearOptions);
  res.json({ success: true });
}
