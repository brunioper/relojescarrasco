"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#a3814d", "#3d6b52", "#4a6d9c", "#b0603a", "#8a6d8f", "#6d8a72"];

type MonthlyPoint = {
  month: string;
  salesUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  purchasesUsd: number;
  expensesUsd: number;
  unitsSold: number;
};

type BrandPoint = { brand: string; salesUsd: number; netProfitUsd: number; units: number };

const monthLabel = (m: string) => {
  const [year, month] = m.split("-");
  const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  return `${names[Number(month) - 1]} ${year!.slice(2)}`;
};

const fmtUsd = (v: number) =>
  `US$ ${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;

export function DashboardCharts({
  monthly,
  byBrand,
}: {
  monthly: MonthlyPoint[];
  byBrand: BrandPoint[];
}) {
  const data = monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ventas por mes (USD)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e0d8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtUsd} />
              <Tooltip formatter={(value: number) => fmtUsd(value)} labelStyle={{ fontSize: 12 }} />
              <Bar dataKey="salesUsd" name="Ventas" fill="#a3814d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ganancia bruta y neta por mes (USD)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e0d8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtUsd} />
              <Tooltip formatter={(value: number) => fmtUsd(value)} labelStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="grossProfitUsd" name="Bruta" stroke="#3d6b52" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="netProfitUsd" name="Neta" stroke="#a3814d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Compras y gastos por mes (USD)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e0d8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} tickFormatter={fmtUsd} />
              <Tooltip formatter={(value: number) => fmtUsd(value)} labelStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="purchasesUsd" name="Compras" fill="#4a6d9c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expensesUsd" name="Gastos" fill="#b0603a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ventas por marca (USD)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {byBrand.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aún no hay ventas registradas
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byBrand}
                  dataKey="salesUsd"
                  nameKey="brand"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {byBrand.map((entry, index) => (
                    <Cell key={entry.brand} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => fmtUsd(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
