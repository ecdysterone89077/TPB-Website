import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { config } from "./config";
import { PrismaService } from "./prisma.service";
import { JwtAuthGuard, RolesGuard } from "./auth";
import { AuditInterceptor } from "./audit";
import { AuthController } from "./controllers/auth.controller";
import { ContentController } from "./controllers/content.controller";
import { PostsController } from "./controllers/posts.controller";
import { PmbController } from "./controllers/pmb.controller";
import { PublicController } from "./controllers/public.controller";
import { AdminController } from "./controllers/admin.controller";
import { BrandController } from "./controllers/brand.controller";
import { NavigationController } from "./controllers/navigation.controller";
import { HeroController } from "./controllers/hero.controller";
import { MarqueeController } from "./controllers/marquee.controller";
import { ContentStatsController } from "./controllers/content-stats.controller";
import { AboutController } from "./controllers/about.controller";
import { ProgramsController } from "./controllers/programs.controller";
import { ResearchController } from "./controllers/research.controller";
import { CommunityController } from "./controllers/community.controller";
import { StudentLifeController } from "./controllers/student-life.controller";
import { ProfilController } from "./controllers/profil.controller";
import { AkademikController } from "./controllers/akademik.controller";
import { PenelitianController } from "./controllers/penelitian.controller";
import { PengabdianController } from "./controllers/pengabdian.controller";
import { KemahasiswaanController } from "./controllers/kemahasiswaan.controller";
import { FooterController } from "./controllers/footer.controller";
import { CtaController } from "./controllers/cta.controller";
import { NewsController } from "./controllers/news.controller";
import { PmbLinkController } from "./controllers/pmb-link.controller";

const jwtSecret = config.jwtAccessSecret;
const accessTtlSeconds = config.jwtAccessTtlSeconds;

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), JwtModule.register({ secret: jwtSecret, signOptions: { expiresIn: accessTtlSeconds } })],
  controllers: [AuthController, ContentController, PostsController, PmbController, PublicController, AdminController, BrandController, NavigationController, HeroController, MarqueeController, ContentStatsController, AboutController, ProgramsController, ResearchController, CommunityController, StudentLifeController, ProfilController, AkademikController, PenelitianController, PengabdianController, KemahasiswaanController, FooterController, CtaController, NewsController, PmbLinkController],
  providers: [PrismaService, JwtAuthGuard, RolesGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
