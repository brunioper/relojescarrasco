import { requireStaffPage } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { aiConfigured } from "@/services/ai/product-detection";
import { readAiBudget } from "@/services/ai/budget";
import {
  InstagramNotSetUpError,
  loadConnectionStatus,
  type InstagramConnection,
} from "@/services/instagram-sync/connection";
import { InstagramConnectionCard } from "@/components/admin/instagram-connection";
import { InstagramInbox, type InboxProduct } from "@/components/admin/instagram-inbox";

export const metadata = { title: "Instagram" };
export const dynamic = "force-dynamic";

export default async function InstagramPage() {
  const ctx = await requireStaffPage();
  const isAdmin = ctx.profile.role === "admin";

  const admin = createAdminClient();
  const budget = await readAiBudget(admin);
  let connection: InstagramConnection | null = null;
  try {
    connection = await loadConnectionStatus(admin);
  } catch (error) {
    if (!(error instanceof InstagramNotSetUpError)) throw error;
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-2xl">Instagram</h1>
        <p className="max-w-2xl rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          Para usar esta sección falta aplicar la actualización de la base de datos de la Etapa 6
          (ver BLOQUEOS.md, punto 6).
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: imports } = await supabase
    .from("instagram_imports")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(60);

  const productIds = [
    ...new Set(
      (imports ?? []).flatMap((row) => [...row.matched_product_ids, ...(row.product_id ? [row.product_id] : [])])
    ),
  ];
  const [{ data: products }, { data: covers }] = productIds.length
    ? await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand, model, status, is_published, listing_price_usd")
          .in("id", productIds),
        supabase
          .from("product_images")
          .select("product_id, storage_path")
          .in("product_id", productIds)
          .eq("is_cover", true),
      ])
    : [{ data: [] }, { data: [] }];

  const coverByProduct = new Map((covers ?? []).map((c) => [c.product_id, c.storage_path]));
  const inboxProducts: InboxProduct[] = (products ?? []).map((p) => ({
    ...p,
    cover_path: coverByProduct.get(p.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Instagram</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Cada historia o publicación nueva con un reloj o una correa se convierte sola en un
          producto del catálogo. Se publica si la imagen muestra el precio en dólares. Si se parece
          a algo que ya está en el catálogo, espera acá tu aprobación.
        </p>
      </div>

      <InstagramConnectionCard
        connection={connection}
        isAdmin={isAdmin}
        aiReady={aiConfigured()}
        aiSpend={{ usd: budget.usage.usd, budget: budget.budget }}
        scheduleReady={Boolean(serverEnv().CRON_SECRET)}
      />

      <InstagramInbox items={imports ?? []} products={inboxProducts} isAdmin={isAdmin} />
    </div>
  );
}
