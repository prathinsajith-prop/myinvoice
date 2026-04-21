import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      twoFactorEnabled: boolean;
      organizationId?: string;
      organizationSlug?: string;
      organizationLogo?: string | null;
      role?: string;
      organizations: Array<{
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        role: string;
      }>;
    } & DefaultSession["user"];
  }

  interface User {
    twoFactorEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    twoFactorEnabled?: boolean;
    organizationId?: string;
    organizationSlug?: string;
    role?: string;
    organizations?: Array<{
      id: string;
      name: string;
      slug: string;
      role: string;
    }>;
    /** Cached user avatar, refreshed at most once per SESSION_REFRESH_TTL_MS. */
    userImage?: string | null;
    /** Cached org logos keyed by org id, refreshed with userImage. */
    orgLogos?: Record<string, string | null>;
    /** Epoch ms of last user/org snapshot refresh. */
    freshAt?: number;
  }
}
