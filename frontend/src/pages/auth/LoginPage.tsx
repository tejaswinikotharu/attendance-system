import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/Toast";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await login(values.email, values.password);
      toast.success("Welcome back!", "Signed in successfully");
      const destination = (location.state as any)?.from?.pathname || "/";
      navigate(destination, { replace: true });
    } catch (err: any) {
      setFormError(err.message || "Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md mb-3">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in to AttendWise
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Intelligent attendance tracking & safe bunk planning
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
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="student@college.edu"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isSubmitting}
            >
              Sign In
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Register now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
