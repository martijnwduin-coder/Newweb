import { notFound } from "next/navigation";
import { ProductView } from "@/components/product-view";

export const metadata = { title: "Product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return <ProductView id={n} />;
}
