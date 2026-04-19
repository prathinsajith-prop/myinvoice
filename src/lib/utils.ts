import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe pagination params — returns valid integers even for garbage input. */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {},
) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "", 10) || (defaults.page ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "", 10) || (defaults.limit ?? 20)),
  );
  return { page, limit, skip: (page - 1) * limit };
}
