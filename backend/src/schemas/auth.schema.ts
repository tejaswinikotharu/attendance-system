import { z } from "zod";

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    fullName: z.string().trim().optional(),
    name: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const val = data.fullName || data.name;
      return typeof val === "string" && val.trim().length >= 2;
    },
    {
      message: "Full name must be at least 2 characters",
      path: ["fullName"],
    }
  )
  .transform((data) => ({
    email: data.email,
    password: data.password,
    fullName: (data.fullName || data.name)!.trim(),
  }));

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Password is required"),
});

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
};
export type LoginInput = z.infer<typeof loginSchema>;
