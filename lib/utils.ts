import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const USM_EMAIL_DOMAIN = "@student.usm.my" as const;

export function isUsmStudentEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(USM_EMAIL_DOMAIN);
}
