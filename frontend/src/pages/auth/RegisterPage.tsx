import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").trim(),
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
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    try {
      await registerAuth(values.email, values.password, values.fullName);
      toast.success("Account created successfully!", "Welcome to AttendWise");
      navigate("/", { replace: true });
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        err.details.forEach((issue: any) => {
          if (issue.field === "fullName" || issue.field === "name") {
            setError("fullName", { type: "server", message: issue.message });
          } else if (issue.field === "email") {
            setError("email", { type: "server", message: issue.message });
          } else if (issue.field === "password") {
            setError("password", { type: "server", message: issue.message });
          }
        });
      }
      setFormError(err.message || "Failed to register account");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md mb-3">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Create your AttendWise account
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Start planning your semester attendance smartly
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {formError && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 leading-relaxed font-medium">
                {formError}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Full Name"
              type="text"
              autoComplete="name"
              placeholder="Alex Johnson"
              error={errors.fullName?.message}
              {...register("fullName")}
            />

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="alex@college.edu"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              helperText="Min 8 characters with at least one letter and number"
              error={errors.password?.message}
              {...register("password")}
            />

            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Create Account
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
