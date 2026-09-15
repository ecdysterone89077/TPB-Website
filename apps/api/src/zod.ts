import { BadRequestException } from "@nestjs/common";
import type { z, ZodTypeAny } from "zod";

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({
      message: "Data tidak valid.",
      issues: result.error.issues.map((i) => {
        let message = i.message;
        if (i.code === "invalid_union") {
          const first = i.unionErrors.flatMap((e) => e.issues).find((e) => e.code !== "invalid_union");
          if (first) message = first.message;
        }
        return { path: i.path.join("."), message };
      }),
    });
  }
  return result.data;
}
