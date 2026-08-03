import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveRate } from "@/services/exchange-rates";
import { totalProductCost } from "@/services/finance/product-cost";
import { computeSaleProfit } from "@/services/finance/sale-profit";
import { grossMarginPct } from "@/services/finance/margins";
import { inventoryAgeDays } from "@/services/finance/inventory";
import { formatAmount, formatPercent, formatUsd, formatUyu } from "@/lib/formatting/currency";
import { formatDate, formatDateTime, todayMontevideo } from "@/lib/formatting/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductStatusBadge } from "@/components/admin/product-status-badge";
import { ProductStatusSelect } from "@/components/admin/product-status-select";
import { ProductForm } from "@/components/admin/product-form";
import { ProductActions } from "@/components/admin/product-actions";
import { ImageManager } from "@/components/admin/image-manager";
import { PurchaseForm } from "@/components/admin/purchase-form";
import { CostsManager } from "@/components/admin/costs-manager";
import { ListingPriceForm } from "@/components/admin/listing-price-form";
import { SellDialog } from "@/components/admin/sell-dialog";
import { StatCard } from "@/components/admin/stat-card";
import type { ProductInput } from "@/lib/validation/schemas";

export const metadata = { title: "Producto" };
export const dynamic = "force-dynamic";

export default async function ProductDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireStaffPage();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: product },
    { data: images },
    { data: purchase },
    { data: costs },
    { data: priceHistory },
    { data: statusHistory },
    { data: sale },
    { data: customers },
    { data: suppliers },
    { data: categories },
    { data: cashAccounts },
    activeRate,
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("product_images")
      .select("id, storage_path, is_cover, sort_order")
      .eq("product_id", id)
      .order("sort_order"),
    supabase
      .from("purchases")
      .select(
        "id, purchase_date, amount, currency, exchange_rate, amount_usd, amount_uyu, supplier_id, payment_method, payment_status, amount_paid, notes"
      )
      .eq("product_id", id)
      .maybeSingle(),
    supabase
      .from("product_costs")
      .select(
        "id, category_id, description, cost_date, amount, currency, amount_usd, amount_uyu, payment_status"
      )
      .eq("product_id", id)
      .is("deleted_at", null)
      .order("cost_date", { ascending: false }),
    supabase
      .from("product_price_history")
      .select(
        "id, old_amount, old_currency, new_amount, new_currency, exchange_rate, new_amount_usd, new_amount_uyu, created_at"
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_status_history")
      .select("id, old_status, new_status, note, created_at")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("sales")
      .select(
        "id, sale_date, amount, currency, exchange_rate, amount_usd, listing_price_usd_at_sale, payment_status, amount_paid"
      )
      .eq("product_id", id)
      .eq("is_cancelled", false)
      .maybeSingle(),
    supabase.from("customers").select("id, full_name").is("deleted_at", null).order("full_name"),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("kind", "costo_producto")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("cash_accounts")
      .select("id, name, currency")
      .eq("is_active", true)
      .order("name"),
    getActiveRate(),
  ]);

  if (!product) notFound();

  const isAdmin = ctx.profile.role === "admin";
  const today = todayMontevideo();
  const totals = totalProductCost(purchase, costs ?? []);
  const ageDays = inventoryAgeDays(purchase?.purchase_date ?? null);

  const saleExpensesUsd = 0; // los gastos de venta se ven en la sección Ventas
  const profit = sale
    ? computeSaleProfit({
        saleAmountUsd: sale.amount_usd,
        totalCostUsd: totals.totalUsd,
        saleExpensesUsd,
        listingPriceUsd: sale.listing_price_usd_at_sale,
        purchaseDate: purchase?.purchase_date ?? null,
        saleDate: sale.sale_date,
      })
    : null;

  const formDefaults: Partial<ProductInput> = {
    name: product.name,
    brand: product.brand,
    model: product.model,
    reference_number: product.reference_number,
    serial_number: product.serial_number,
    year_approx: product.year_approx,
    movement: product.movement,
    case_material: product.case_material,
    strap_material: product.strap_material,
    diameter_mm: product.diameter_mm,
    water_resistance: product.water_resistance,
    gender: product.gender,
    condition: product.condition,
    includes_box: product.includes_box,
    includes_documentation: product.includes_documentation,
    includes_accessories: product.includes_accessories,
    public_description: product.public_description,
    internal_notes: product.internal_notes,
    is_featured: product.is_featured,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/productos" aria-label="Volver a productos">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl">{product.name}</h1>
              {isAdmin ? (
                <ProductStatusSelect productId={product.id} status={product.status} />
              ) : (
                <ProductStatusBadge status={product.status} />
              )}
              {product.is_published && <Badge variant="success">Publicado</Badge>}
            </div>
            {isAdmin && product.status !== "vendido" && product.status !== "archivado" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Para publicar, el estado debe ser <strong>Disponible</strong> o{" "}
                <strong>Reservado</strong> y debe tener un precio de lista definido.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {product.brand} {product.model}
              {product.reference_number && ` · Ref. ${product.reference_number}`}
              {product.is_published && (
                <Link
                  href={`/catalogo/${product.slug}`}
                  target="_blank"
                  className="ml-2 inline-flex items-center gap-1 text-gold hover:underline"
                >
                  Ver en el sitio <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {product.status !== "vendido" && product.status !== "archivado" && (
              <SellDialog
                productId={product.id}
                productName={product.name}
                listingUsd={product.listing_price_usd}
                customers={customers ?? []}
                cashAccounts={cashAccounts ?? []}
                activeRate={activeRate?.rate ?? null}
                today={today}
                purchaseDate={purchase?.purchase_date ?? null}
              />
            )}
            <ProductActions
              productId={product.id}
              status={product.status}
              isPublished={product.is_published}
              activeSaleId={sale?.id ?? null}
            />
          </div>
        )}
      </div>

      {/* Resumen financiero */}
      <section aria-label="Resumen financiero del producto">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            title="Costo total"
            value={formatUsd(totals.totalUsd)}
            subtitle={`${formatUyu(totals.totalUyu)} UYU`}
            hint="Precio de compra + costos directos, con las cotizaciones históricas de cada operación."
          />
          <StatCard
            title="Precio de lista"
            value={product.listing_price_usd !== null ? formatUsd(product.listing_price_usd) : "Sin precio"}
            subtitle={
              product.listing_price_currency === "UYU"
                ? `Original: ${formatUyu(product.listing_price_amount ?? 0)} UYU`
                : undefined
            }
          />
          {sale && profit ? (
            <>
              <StatCard
                title="Venta real"
                value={formatUsd(sale.amount_usd)}
                subtitle={`${formatDate(sale.sale_date)} · cotización ${sale.exchange_rate}`}
              />
              <StatCard
                title="Ganancia bruta"
                value={formatUsd(profit.grossProfitUsd)}
                tone={profit.grossProfitUsd >= 0 ? "positive" : "negative"}
                subtitle={`Margen: ${formatPercent(grossMarginPct(profit.grossProfitUsd, sale.amount_usd))}`}
                hint="Ganancia bruta = venta real − costo total. La neta descuenta además los gastos de la venta (ver Ventas)."
              />
            </>
          ) : (
            <>
              <StatCard
                title="Ganancia potencial"
                value={
                  product.listing_price_usd !== null
                    ? formatUsd(product.listing_price_usd - totals.totalUsd)
                    : "—"
                }
                tone={
                  product.listing_price_usd !== null &&
                  product.listing_price_usd - totals.totalUsd >= 0
                    ? "positive"
                    : "neutral"
                }
                hint="Precio de lista menos costo total. Estimación hasta concretar la venta."
              />
              <StatCard
                title="Días en stock"
                value={ageDays !== null ? `${ageDays} días` : "—"}
                subtitle={purchase ? `Comprado el ${formatDate(purchase.purchase_date)}` : "Sin compra registrada"}
              />
            </>
          )}
        </div>
      </section>

      <Tabs defaultValue="datos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="imagenes">Imágenes ({(images ?? []).length})</TabsTrigger>
          <TabsTrigger value="compra">Compra y costos</TabsTrigger>
          <TabsTrigger value="precio">Precio de lista</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          {isAdmin ? (
            <ProductForm productId={product.id} defaultValues={formDefaults} />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Su rol es de solo consulta: no puede modificar productos.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="imagenes">
          <Card>
            <CardContent className="p-6">
              {isAdmin ? (
                <ImageManager productId={product.id} images={images ?? []} />
              ) : (
                <p className="text-sm text-muted-foreground">Solo consulta.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compra" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compra</CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <PurchaseForm
                  productId={product.id}
                  purchase={purchase}
                  suppliers={suppliers ?? []}
                  activeRate={activeRate?.rate ?? null}
                  today={today}
                />
              ) : purchase ? (
                <p className="text-sm">
                  Comprado el {formatDate(purchase.purchase_date)} por{" "}
                  {formatAmount(purchase.amount, purchase.currency)} (cotización {purchase.exchange_rate}).
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Sin compra registrada.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Costos directos</CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <CostsManager
                  productId={product.id}
                  costs={costs ?? []}
                  categories={categories ?? []}
                  suppliers={suppliers ?? []}
                  activeRate={activeRate?.rate ?? null}
                  today={today}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {costs?.length ?? 0} costos registrados por {formatUsd(totals.costsUsd)}.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="precio">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Precio de lista</CardTitle>
            </CardHeader>
            <CardContent>
              {isAdmin ? (
                <ListingPriceForm
                  productId={product.id}
                  current={{
                    amount: product.listing_price_amount,
                    currency: product.listing_price_currency,
                    usd: product.listing_price_usd,
                    uyu: product.listing_price_uyu,
                    rate: product.listing_exchange_rate,
                  }}
                  activeRate={activeRate?.rate ?? null}
                  today={today}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Solo consulta.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de precios</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Anterior</TableHead>
                    <TableHead>Nuevo</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                    <TableHead className="text-right">Cotización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(priceHistory ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        Sin cambios de precio registrados.
                      </TableCell>
                    </TableRow>
                  )}
                  {(priceHistory ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{formatDateTime(row.created_at)}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {row.old_amount !== null && row.old_currency
                          ? formatAmount(row.old_amount, row.old_currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatAmount(row.new_amount, row.new_currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatUsd(row.new_amount_usd)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{row.exchange_rate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de estados</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(statusHistory ?? []).map((row) => (
                  <li key={row.id} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </span>
                    {row.old_status && (
                      <>
                        <ProductStatusBadge status={row.old_status} />
                        <span className="text-muted-foreground">→</span>
                      </>
                    )}
                    <ProductStatusBadge status={row.new_status} />
                    {row.note && <span className="text-muted-foreground">· {row.note}</span>}
                  </li>
                ))}
                {(statusHistory ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">Sin cambios registrados.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
