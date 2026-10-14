import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../middleware/error.middleware.js";
import { LoginInput, RegisterInput } from "../schemas/auth.schema.js";
import { prisma } from "../utils/db.js";

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    createdAt: Date;
  };
  token: string;
}

export const registerStudent = async (
  input: RegisterInput
): Promise<AuthResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    const error: AppError = new Error("A student with this email address already exists.");
    error.statusCode = 409;
    throw error;
  }

  // Secure password hashing with 12 salt rounds
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      createdAt: true,
    },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, fullName: user.fullName },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  return { user, token };
};

export const loginStudent = async (input: LoginInput): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    const error: AppError = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    const error: AppError = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, fullName: user.fullName },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
    },
    token,
  };
};

export const getCurrentStudent = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      createdAt: true,
      semesters: {
        where: { isCurrent: true },
        take: 1,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          targetPercent: true,
        },
      },
    },
  });

  if (!user) {
    const error: AppError = new Error("Student profile not found.");
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    createdAt: user.createdAt,
    activeSemester: user.semesters[0] || null,
  };
};
