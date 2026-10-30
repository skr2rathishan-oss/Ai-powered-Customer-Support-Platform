import { DashboardEmpty } from "../dashboard/DashboardCard";
import type { CustomerOrder, OrderStatus } from "../../types/customer";

const STATUS_STYLES: Record<OrderStatus, { className: string; icon: string }> = {
  Processing: { className: "bg-amber-50 text-amber-700 border-amber-200", icon: "inventory_2" },
  Shipped: { className: "bg-sky-50 text-sky-700 border-sky-200", icon: "local_shipping" },
  Delivered: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "check_circle" },
  Cancelled: { className: "bg-slate-100 text-slate-600 border-slate-200", icon: "cancel" },
  Returned: { className: "bg-violet-50 text-violet-700 border-violet-200", icon: "assignment_return" },
};

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function deliveryNote(order: CustomerOrder): string {
  if (order.status === "Delivered" && order.deliveredAt) return `Delivered ${formatDate(order.deliveredAt)}`;
  if (order.status === "Shipped") {
    const parts = [
      order.carrier,
      order.trackingNumber && `tracking ${order.trackingNumber}`,
      order.estimatedDelivery && `arrives by ${formatDate(order.estimatedDelivery)}`,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (order.status === "Processing" && order.estimatedDelivery) {
    return `Expected by ${formatDate(order.estimatedDelivery)}`;
  }
  return "";
}

/** The customer's orders with their items, newest first. */
export function OrderList({ orders }: { orders: CustomerOrder[] }) {
  if (orders.length === 0) {
    return <DashboardEmpty icon="shopping_bag" text="You haven't placed any orders yet." />;
  }

  return (
    <ul className="divide-y divide-[#e2e4e9]/70 -mx-2">
      {orders.map((order) => {
        const style = STATUS_STYLES[order.status] ?? STATUS_STYLES.Processing;
        const note = deliveryNote(order);
        return (
          <li key={order.orderId} className="px-2 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs font-mono font-semibold text-[#1c1b23]">{order.orderNumber}</span>
              <span className="text-[11px] text-[#787586]">Ordered {formatDate(order.orderedAt)}</span>
              <span
                className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${style.className}`}
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {style.icon}
                </span>
                {order.status}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {order.items.map((item) => (
                <li key={item.itemId} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 text-[#474555]">
                    <span className="font-semibold text-[#1c1b23]">{item.quantity} ×</span> {item.productName}
                    {item.size || item.color ? (
                      <span className="text-[#787586]">
                        {" "}
                        ({[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(", ")})
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[#787586]">{formatMoney(item.unitPrice * item.quantity, order.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-[#787586]">{note}</span>
              <span className="font-bold text-[#1c1b23]">Total {formatMoney(order.totalAmount, order.currency)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
