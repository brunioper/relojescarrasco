import { AlertTriangle } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveRate } from "@/services/exchange-rates";
import { todayMontevideo, formatDate } from "@/lib/formatting/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CatalogueRateModeForm,
  FetchRateButton,
  NewRateDialog,
  RateActiveSwitch,
} from "@/components/admin/rate-dialogs";

export const metadata = { title: "Cotizaciones" };
export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const ctx = await requireStaffPage();
  const supabase = await createClient();
  const isAdmin = ctx.profile.role === "admin";

  const [{ data: rates }, { data: catalogueSetting }, { data: warningSetting }, activeRate] =
    await Promise.all([
      supabase
        .from("exchange_rates")
        .select("id, rate, buy_rate, sell_rate, rate_date, source, is_manual, is_active, created_at")
        .order("rate_date", { ascending: false })
        .limit(100),
      supabase
        .from("application_settings")
        .select("value")
        .eq("key", "catalogue_exchange_rate")
        .maybeSingle(),
      supabase
        .from("application_settings")
        .select("value")
        .eq("key", "exchange_rate_warning_days")
        .maybeSingle(),
      getActiveRate(),
    ]);

  const catalogueValue = catalogueSetting?.value as
    | { mode?: string; value?: number | null }
    | null;
  const warningDays = Number(
    (warningSetting?.value as { value?: number } | null)?.value ?? 7
  );
  const stale = activeRate && activeRate.ageDays > warningDays;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Cotizaciones USD/UYU</h1>
          <p className="text-sm text-muted-foreground">
            Las cotizaciones históricas son inmutables: cada operación conserva la suya para siempre.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <FetchRateButton />
            <NewRateDialog today={todayMontevideo()} />
          </div>
        )}
      </div>

      {!activeRate && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          No hay ninguna cotización cargada. El catálogo público mostrará solo precios en USD.
        </div>
      )}
      {stale && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          La cotización activa tiene {activeRate.ageDays} días (límite configurado: {warningDays}).
        </div>
      )}
      {catalogueValue?.mode === "fixed" && (
        <div className="flex items-center gap-3 rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          El catálogo usa una cotización fija manual ($ {catalogueValue.value}), no la última activa.
        </div>
      )}

      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cotización del catálogo público</CardTitle>
          </CardHeader>
          <CardContent>
            <CatalogueRateModeForm
              mode={(catalogueValue?.mode as "latest" | "fixed") ?? "latest"}
              fixedValue={catalogueValue?.value ?? null}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Al cambiar la cotización del catálogo solo se recalcula el valor aproximado en UYU que
              ve el público. Los precios USD y las operaciones históricas no se modifican.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Aplicada</TableHead>
                <TableHead className="text-right">Compra</TableHead>
                <TableHead className="text-right">Venta</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead>Activa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rates ?? []).map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="text-sm">{formatDate(rate.rate_date)}</TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    $ {rate.rate}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {rate.buy_rate !== null ? `$ ${rate.buy_rate}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {rate.sell_rate !== null ? `$ ${rate.sell_rate}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rate.is_manual ? "secondary" : "info"}>
                      {rate.is_manual ? "Manual" : `Automática (${rate.source})`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <RateActiveSwitch rateId={rate.id} isActive={rate.is_active} />
                    ) : rate.is_active ? (
                      <Badge variant="success">Sí</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(rates ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin cotizaciones registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
