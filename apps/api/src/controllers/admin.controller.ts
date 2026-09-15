import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { hash } from "@node-rs/argon2";
import { memoryStorage } from "multer";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import type { Request } from "express";
import { UserInputSchema, UserUpdateSchema } from "@tpb/contracts";
import { config } from "../config";
import { detectMediaType } from "../media";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, type RequestUser } from "../auth";
import { parse } from "../zod";
import { parsePagination, paginationMeta } from "../pagination";

type AuthRequest = Request & { user?: RequestUser };

const MEDIA_DIR = config.mediaDir;
const MEDIA_MAX_MB = config.mediaMaxMb;

@Controller()
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- users

  @Get("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async listUsers(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.user.count(),
    ]);
    return {
      users: rows.map((r) => ({
        id: r.id, email: r.email, name: r.name, role: r.role, isActive: r.isActive,
        createdAt: r.createdAt.toISOString(), lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      })),
      pagination: paginationMeta(pagination, total),
    };
  }

  @Post("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async createUser(@Body() body: unknown) {
    const input = parse(UserInputSchema, body);
    const passwordHash = await hash(input.password);
    const user = await this.prisma.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash, role: input.role } });
    return { user: { ...user, passwordHash: undefined } };
  }

  private async guardedTransaction<T>(work: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error: any) {
      if (error?.code === "P2034") throw new ConflictException("Data pengguna sedang diubah proses lain. Coba lagi.");
      throw error;
    }
  }

  @Put("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async updateUser(@Param("id") id: string, @Body() body: unknown) {
    const input = parse(UserUpdateSchema, body);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password) data.passwordHash = await hash(input.password);
    const demotes = (input.role !== undefined && input.role !== "ADMIN") || input.isActive === false;
    let user: any;
    if (demotes) {
      user = await this.guardedTransaction(async (tx) => {
        const target = await tx.user.findUnique({ where: { id } });
        if (!target) throw new NotFoundException("Pengguna tidak ditemukan.");
        if (target.role === "ADMIN" && target.isActive) {
          const otherAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
          if (otherAdmins === 0) throw new BadRequestException("Tidak dapat menonaktifkan atau menurunkan admin aktif terakhir.");
        }
        return tx.user.update({ where: { id }, data });
      });
    } else {
      try {
        user = await this.prisma.user.update({ where: { id }, data });
      } catch (error: any) {
        if (error?.code === "P2025") throw new NotFoundException("Pengguna tidak ditemukan.");
        throw error;
      }
    }
    return { user: { ...user, passwordHash: undefined } };
  }

  @Delete("users/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async deleteUser(@Param("id") id: string, @Req() req: AuthRequest) {
    if (req.user?.id === id) throw new BadRequestException("Tidak dapat menghapus akun sendiri.");
    await this.guardedTransaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw new NotFoundException("Pengguna tidak ditemukan.");
      if (target.role === "ADMIN" && target.isActive) {
        const otherAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true, id: { not: id } } });
        if (otherAdmins === 0) throw new BadRequestException("Tidak dapat menghapus admin aktif terakhir.");
      }
      await tx.user.delete({ where: { id } });
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- audit

  @Get("audit")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async listAudit(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit, include: { user: { select: { email: true } } } }),
      this.prisma.auditLog.count(),
    ]);
    return {
      audit: rows.map((r) => ({
        id: r.id, userId: r.userId, action: r.action, entity: r.entity, entityId: r.entityId,
        metadata: r.metadata, ip: r.ip, createdAt: r.createdAt.toISOString(), user: r.user ? { email: r.user.email } : null,
      })),
      pagination: paginationMeta(pagination, total),
    };
  }

  // ------------------------------------------------------------ dashboard

  @Get("dashboard/summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async dashboardSummary() {
    const [posts, newPmb, subscribers, media, audit] = await Promise.all([
      this.prisma.post.count({ where: { deletedAt: null } }),
      this.prisma.pmbRegistration.count({ where: { deletedAt: null, status: "baru" } }),
      this.prisma.subscriber.count(),
      this.prisma.mediaAsset.count(),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { email: true } } } }),
    ]);
    return {
      posts, newPmb, subscribers, media,
      audit: audit.map((r) => ({
        id: r.id, userId: r.userId, action: r.action, entity: r.entity, entityId: r.entityId,
        metadata: r.metadata, ip: r.ip, createdAt: r.createdAt.toISOString(), user: r.user ? { email: r.user.email } : null,
      })),
    };
  }

  // ---------------------------------------------------------------- media

  @Post("media/upload")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "OPERATOR")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MEDIA_MAX_MB * 1024 * 1024, files: 1 },
    }),
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("Berkas tidak diterima.");
    const detected = detectMediaType(file.buffer);
    if (!detected) throw new BadRequestException("Jenis berkas tidak diizinkan. Gunakan JPEG, PNG, GIF, WebP, atau PDF.");
    const filename = `${randomUUID()}${detected.ext}`;
    const stored = join(MEDIA_DIR, filename);
    const originalName = file.originalname.trim().slice(0, 255);
    await writeFile(stored, file.buffer, { flag: "wx" });
    try {
      const asset = await this.prisma.mediaAsset.create({
        data: { url: `/media/${filename}`, filename: originalName, mimeType: detected.mime, size: file.size, alt: null },
      });
      return { item: { ...asset, createdAt: asset.createdAt.toISOString() } };
    } catch (error) {
      await unlink(stored).catch(() => {});
      throw error;
    }
  }

  @Delete("media/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async removeMedia(@Param("id") id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (asset) {
      await unlink(join(MEDIA_DIR, basename(asset.url))).catch(() => {});
      await this.prisma.mediaAsset.delete({ where: { id } });
    }
    return { ok: true };
  }

  @Get("media")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR", "OPERATOR")
  async listMedia(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.mediaAsset.count(),
    ]);
    return { media: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), pagination: paginationMeta(pagination, total) };
  }
}