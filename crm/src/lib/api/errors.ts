import { NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/session";

export { ForbiddenError, UnauthorizedError };

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Không tìm thấy dữ liệu") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json(
      { error: "Bạn không có quyền thực hiện thao tác này" },
      { status: 403 }
    );
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof ConflictError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  console.error(err);
  return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
}
