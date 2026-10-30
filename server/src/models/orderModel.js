const { getMySQLPool } = require("../config/database");

// Orders are always read for one customer of one company, so a customer can
// only ever see their own purchases. `options.pool` exists for tests.
const ORDER_LIST_LIMIT = 20;

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

function toItem(row) {
  return {
    itemId: row.itemId,
    productName: row.productName,
    size: row.size ?? null,
    color: row.color ?? null,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
  };
}

function toOrder(row, items) {
  return {
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    status: row.status,
    shippingFee: Number(row.shippingFee),
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    shippingAddress: row.shippingAddress ?? null,
    carrier: row.carrier ?? null,
    trackingNumber: row.trackingNumber ?? null,
    orderedAt: row.orderedAt,
    estimatedDelivery: row.estimatedDelivery ?? null,
    deliveredAt: row.deliveredAt ?? null,
    items,
  };
}

/** The customer's most recent orders, newest first, each with its items. */
async function listCustomerOrders(companyId, customerId, options) {
  const pool = poolFrom(options);
  const [orders] = await pool.execute(
    `SELECT
       order_id AS orderId,
       order_number AS orderNumber,
       status,
       shipping_fee AS shippingFee,
       total_amount AS totalAmount,
       currency,
       shipping_address AS shippingAddress,
       carrier,
       tracking_number AS trackingNumber,
       ordered_at AS orderedAt,
       DATE_FORMAT(estimated_delivery, '%Y-%m-%d') AS estimatedDelivery,
       delivered_at AS deliveredAt
     FROM orders
     WHERE company_id = ? AND customer_id = ?
     ORDER BY ordered_at DESC, order_id DESC
     LIMIT ${ORDER_LIST_LIMIT}`,
    [companyId, customerId],
  );
  if (orders.length === 0) return [];

  const ids = orders.map((order) => order.orderId);
  const [items] = await pool.execute(
    `SELECT
       item_id AS itemId,
       order_id AS orderId,
       product_name AS productName,
       size,
       color,
       quantity,
       unit_price AS unitPrice
     FROM order_items
     WHERE order_id IN (${ids.map(() => "?").join(", ")})
     ORDER BY item_id ASC`,
    ids,
  );

  return orders.map((order) =>
    toOrder(
      order,
      items.filter((item) => item.orderId === order.orderId).map(toItem),
    ),
  );
}

module.exports = { listCustomerOrders, ORDER_LIST_LIMIT };
